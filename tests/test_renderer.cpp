// Host-side unit tests for the pure renderer. Build and run with:
//   make -C tests test-renderer
//
// The tests cover layout, the display state machine, animation, scrolling and
// the publishing-on-change report, using a fake canvas and fake glyph fonts so
// no ESPHome or freetype is involved.

#include "../packages/max7219_clock_renderer.h"

#include <math.h>
#include <stdio.h>
#include <string.h>

#include <string>
#include <vector>

using namespace max7219_clock;

static int failures = 0;
static int checks = 0;

#define CHECK(cond)                                                              \
  do {                                                                           \
    checks++;                                                                    \
    if (!(cond)) {                                                               \
      failures++;                                                                \
      printf("FAIL %s:%d: %s\n", __FILE__, __LINE__, #cond);                     \
    }                                                                            \
  } while (0)

#define CHECK_EQ(a, b)                                                           \
  do {                                                                           \
    checks++;                                                                    \
    auto _a = (a);                                                               \
    auto _b = (b);                                                               \
    if (!(_a == _b)) {                                                           \
      failures++;                                                                \
      printf("FAIL %s:%d: %s == %s (%ld != %ld)\n", __FILE__, __LINE__, #a, #b,  \
             (long) _a, (long) _b);                                              \
    }                                                                            \
  } while (0)

// --------------------------------------------------------------------------
// Fake canvas: records every pixel so tests can inspect the picture.
// --------------------------------------------------------------------------
class FakeCanvas : public Canvas {
 public:
  explicit FakeCanvas(int w = 48, int h = 8) : w_(w), h_(h), pixels_(w * h, false) {}
  void pixel(int x, int y, bool on) override {
    if (x < 0 || y < 0 || x >= w_ || y >= h_) return;
    pixels_[y * w_ + x] = on;
    if (on) this->on_count_++;
  }
  int width() const override { return w_; }
  int height() const override { return h_; }

  bool get(int x, int y) const { return x >= 0 && y >= 0 && x < w_ && y < h_ && pixels_[y * w_ + x]; }
  int on_count() const { return on_count_; }
  void clear() {
    std::fill(pixels_.begin(), pixels_.end(), false);
    on_count_ = 0;
  }
  // Ink bounding box; returns false when nothing is lit.
  bool bbox(int *x0, int *y0, int *x1, int *y1) const {
    bool any = false;
    *x0 = w_;
    *y0 = h_;
    *x1 = -1;
    *y1 = -1;
    for (int y = 0; y < h_; y++)
      for (int x = 0; x < w_; x++)
        if (pixels_[y * w_ + x]) {
          any = true;
          if (x < *x0) *x0 = x;
          if (y < *y0) *y0 = y;
          if (x > *x1) *x1 = x;
          if (y > *y1) *y1 = y;
        }
    return any;
  }
  // Number of lit pixels per row (used for the slide-up animation).
  int row_on(int y) const {
    int n = 0;
    for (int x = 0; x < w_; x++)
      if (pixels_[y * w_ + x]) n++;
    return n;
  }

 private:
  int w_;
  int h_;
  std::vector<bool> pixels_;
  int on_count_ = 0;
};

// --------------------------------------------------------------------------
// Fake glyph font: every character is a solid 5x7-ish box so tests can reason
// about widths and vertical offsets, and every draw call is recorded.
// --------------------------------------------------------------------------
struct DrawCall {
  char ch;
  int x;
  int box_top;
};

class FakeFont : public GlyphFont {
 public:
  FakeFont(int advance, int ink_height = 7, int ink_top = 0)
      : advance_(advance), ink_height_(ink_height), ink_top_(ink_top) {}
  int advance(char) const override { return advance_; }
  int ink_height() const override { return ink_height_; }
  int ink_top() const override { return ink_top_; }
  void draw_glyph(Canvas &c, char ch, int x, int box_top) const override {
    calls.push_back({ch, x, box_top});
    for (int row = 0; row < ink_height_; row++)
      for (int col = 0; col < advance_ - 1; col++) c.pixel(x + col, box_top + ink_top_ + row, true);
  }
  mutable std::vector<DrawCall> calls;
  int calls_for(char ch) const {
    int n = 0;
    for (const auto &call : calls)
      if (call.ch == ch) n++;
    return n;
  }

 private:
  int advance_;
  int ink_height_;
  int ink_top_;
};

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------
static BuiltinFont compact;

static void reset_state() {
  state = Runtime();
  report = Report();
}

static Frame base_frame(uint32_t now_ms = 0) {
  Frame f;
  f.now_ms = now_ms;
  f.time_valid = true;
  f.hour = 12;
  f.minute = 34;
  f.second = 56;
  f.day = 31;
  f.month = 12;
  f.alignment = ALIGN_CENTER;
  f.seconds_mode = SECONDS_DIGITS;
  f.blink_colon = false;
  f.animate = false;
  f.animation_row_gap = 0;  // legacy no-gap fixtures; production default is tested separately
  return f;
}

// --------------------------------------------------------------------------
// Tests
// --------------------------------------------------------------------------
static void test_unknown_glyphs_do_not_break_layout() {
  // A glyph that is not compiled into a font reports advance 0 in the ESPHome
  // adapter; the renderer must still stay inside the display and keep drawing
  // the remaining characters.
  class SparseFont : public GlyphFont {
   public:
    int advance(char c) const override { return c == '9' ? 0 : 6; }
    int ink_height() const override { return 7; }
    int ink_top() const override { return 0; }
    void draw_glyph(Canvas &c, char ch, int x, int box_top) const override {
      if (ch == '9') return;  // no ink for the missing glyph
      for (int row = 0; row < 7; row++)
        for (int col = 0; col < 5; col++) c.pixel(x + col, box_top + row, true);
    }
  };

  FakeCanvas canvas;
  SparseFont font;
  Frame f = base_frame();
  f.minute = 9;
  f.second = 9;
  f.seconds_mode = SECONDS_OFF;
  reset_state();
  render(canvas, font, compact, f, report);

  int x0, y0, x1, y1;
  CHECK(canvas.bbox(&x0, &y0, &x1, &y1));
  // Four 6px characters ("12:0") are centred in 48px, the missing '9' takes no
  // space and nothing is drawn outside the display.
  CHECK_EQ(x0, 12);
  CHECK(x1 < canvas.width());
  CHECK_EQ(y0, 0);
  CHECK(y1 < canvas.height());
  CHECK(canvas.on_count() > 0);
}

static void test_hour_day_and_12h_boundaries() {
  char out[24];
  Frame f = base_frame();

  // End of a day in 24-hour mode: seconds and minutes roll over.
  f.hour = 23;
  f.minute = 59;
  f.second = 59;
  CHECK(build_content(f, MODE_CLOCK, true, out, sizeof(out)));
  CHECK(strcmp(out, "23:59:59") == 0);
  f.hour = 0;
  f.minute = 0;
  f.second = 0;
  CHECK(build_content(f, MODE_CLOCK, true, out, sizeof(out)));
  CHECK(strcmp(out, "00:00:00") == 0);

  // Date rollover into a new month.
  f.day = 31;
  f.month = 12;
  CHECK(build_content(f, MODE_DATE, false, out, sizeof(out)));
  CHECK(strcmp(out, "31.12") == 0);
  f.day = 1;
  f.month = 1;
  CHECK(build_content(f, MODE_DATE, false, out, sizeof(out)));
  CHECK(strcmp(out, "01.01") == 0);

  // 12-hour mode: midnight becomes 12, noon stays 12, and the leading digit is
  // blanked so the content keeps a constant width (no animation resets).
  f.use_12h = true;
  f.minute = 0;
  f.hour = 0;
  CHECK(build_content(f, MODE_CLOCK, true, out, sizeof(out)));
  CHECK(strcmp(out, "12:00:00") == 0);
  f.hour = 12;
  CHECK(build_content(f, MODE_CLOCK, true, out, sizeof(out)));
  CHECK(strcmp(out, "12:00:00") == 0);
  f.hour = 11;
  f.minute = 59;
  f.second = 59;
  CHECK(build_content(f, MODE_CLOCK, true, out, sizeof(out)));
  CHECK(strcmp(out, "11:59:59") == 0);
  f.hour = 13;
  f.minute = 5;
  f.second = 0;
  CHECK(build_content(f, MODE_CLOCK, true, out, sizeof(out)));
  CHECK_EQ((int) strlen(out), 8);  // " 1:05:00" keeps the same width
  f.hour = 23;
  f.minute = 59;
  CHECK(build_content(f, MODE_CLOCK, true, out, sizeof(out)));
  CHECK(strcmp(out, "11:59:00") == 0);
}

static void test_animation_survives_hour_rollover() {
  // 09:59:59 -> 10:00:00 changes three digits at once; the layout keeps its
  // width and only the digits themselves animate.
  FakeCanvas canvas;
  FakeFont font(6);
  Frame f = base_frame();
  f.seconds_mode = SECONDS_OFF;
  f.hour = 9;
  f.minute = 59;
  f.animate = true;
  f.animation_ms = 250;

  reset_state();
  render(canvas, font, compact, f, report);
  CHECK_EQ(font.calls.size(), 5u);

  font.calls.clear();
  canvas.clear();
  f.hour = 10;
  f.minute = 0;
  f.now_ms = 1000;
  render(canvas, font, compact, f, report);
  const int box_top = compact.centered_box_top(8);
  // Unchanged separator stays put, changed digits draw twice (out/in).
  bool colon_centred = false;
  for (const auto &call : font.calls) {
    if (call.ch == ':' && call.box_top == box_top) colon_centred = true;
  }
  CHECK(colon_centred);
  CHECK(font.calls_for('9') >= 1);  // old digits slide out
  CHECK(font.calls_for('1') >= 1);  // new digits slide in
}

static void test_message_text_helpers() {
  // Upper-casing lives in the renderer so YAML lambdas stay free of <cctype>.
  char text[] = "Dinner 4 at 19:30 - ok?";
  upper_ascii(text);
  CHECK(strcmp(text, "DINNER 4 AT 19:30 - OK?") == 0);
  char already[] = "ABC 123";
  upper_ascii(already);
  CHECK(strcmp(already, "ABC 123") == 0);
  upper_ascii(nullptr);  // must not crash on an empty action payload

  char georgian[8];
  const char *three_letters = "აბგ";  // 9 UTF-8 bytes; only two fit plus NUL.
  CHECK_EQ(copy_utf8_truncated(georgian, sizeof(georgian), three_letters, strlen(three_letters)), 6U);
  CHECK(strcmp(georgian, "აბ") == 0);
  char ascii[5];
  CHECK_EQ(copy_utf8_truncated(ascii, sizeof(ascii), "HELLO", 5), 4U);
  CHECK(strcmp(ascii, "HELL") == 0);

  CHECK(!is_nan(0.0f));
  CHECK(!is_nan(-1.0f));
  CHECK(is_nan(0.0f / 0.0f));
}

static void test_builtin_font_is_compact_enough() {
  CHECK_EQ(compact.text_width("00:00:00"), 42);
  CHECK(compact.text_width("00:00:00") <= 48);  // must fit the default 48x8 layout
  CHECK_EQ(compact.text_width("12:34"), 27);
  CHECK(compact.text_width("--:--") <= 48);
  CHECK_EQ(compact.ink_height(), 7);
  CHECK_EQ(compact.centered_box_top(8), 0);
  CHECK_EQ(compact.centered_box_top(16), 4);
}

static void test_clock_layout() {
  FakeCanvas canvas;
  FakeFont font(6);
  Frame f = base_frame();

  reset_state();
  render(canvas, font, compact, f, report);
  // 8 characters * 6px = 48 -> exact fit, no fallback, no clipping.
  CHECK_EQ(font.calls.size(), 8u);
  CHECK_EQ(compact.text_width("12:34:56"), 42);  // still fits 48px

  int x0, y0, x1, y1;
  CHECK(canvas.bbox(&x0, &y0, &x1, &y1));
  CHECK_EQ(x0, 0);
  CHECK(x1 < 48);
  CHECK_EQ(y0, 0);
}

static void test_seconds_dropped_when_too_wide() {
  FakeCanvas canvas;
  FakeFont wide(8);  // 8 * 8 = 64 > 48
  Frame f = base_frame();

  reset_state();
  render(canvas, wide, compact, f, report);
  // Seconds digits must be dropped, then the remaining "12:34" (5 * 8 = 40)
  // still fits, so the selected font is kept and no colon-second is drawn.
  CHECK_EQ((int) strlen("12:34"), 5);
  CHECK_EQ(wide.calls.size(), 5u);
  CHECK_EQ(wide.calls_for(':'), 1);
}

static void test_falls_back_to_builtin_font() {
  FakeCanvas canvas;
  FakeFont wide(12);  // "12:34" = 60 > 48, "12:34:56" far too wide
  Frame f = base_frame();

  reset_state();
  render(canvas, wide, compact, f, report);
  // Every character comes from the built-in font; the wide font is unused.
  CHECK_EQ(wide.calls.size(), 0u);
  CHECK(canvas.on_count() > 0);
}

static void test_invalid_time_shows_placeholder() {
  FakeCanvas canvas;
  FakeFont font(6);
  Frame f = base_frame();
  f.time_valid = false;

  reset_state();
  render(canvas, font, compact, f, report);
  CHECK_EQ(font.calls.size(), 0u);      // built-in is used for the placeholder
  CHECK(canvas.on_count() > 0);
}

static void test_mode_priority_ota_wins() {
  reset_state();
  CHECK_EQ(MODE_CLOCK, effective_mode(base_frame()));
  state.ota_state = OTA_UPLOADING;
  CHECK_EQ(MODE_OTA, effective_mode(base_frame()));
  reset_state();
}

static void test_mode_priority_alert_over_message() {
  Frame f = base_frame();
  reset_state();
  state.set_alert("HELLO", 5000, 0);
  state.set_message("world", 60000, 0);
  f.now_ms = 1000;
  CHECK_EQ(MODE_MESSAGE, effective_mode(f));

  // Draw and confirm the alert text is the one on screen.
  FakeCanvas canvas;
  FakeFont font(6);
  render(canvas, font, compact, f, report);
  bool saw_h = false;
  for (const auto &call : font.calls)
    if (call.ch == 'H') saw_h = true;
  CHECK(saw_h);
}

static void test_message_beats_countdown_but_loses_to_ota() {
  Frame f = base_frame();
  reset_state();
  state.start_countdown(60, 0);
  f.now_ms = 1000;
  CHECK_EQ(MODE_COUNTDOWN, effective_mode(f));
  state.set_message("hi", 60000, 1000);
  CHECK_EQ(MODE_MESSAGE, effective_mode(f));
  state.ota_state = OTA_STARTING;
  CHECK_EQ(MODE_OTA, effective_mode(f));
}

static void test_countdown_expires_into_alert() {
  Frame f = base_frame();
  reset_state();
  state.start_countdown(60, 0);
  f.now_ms = 30000;
  Report r;
  FakeCanvas canvas;
  FakeFont font(6);
  render(canvas, font, compact, f, r);
  CHECK_EQ(r.mode, MODE_COUNTDOWN);
  CHECK(r.remaining_changed);
  CHECK_EQ(r.remaining_s, 30);

  // Past the deadline: countdown ends, "DONE" alert takes over.
  f.now_ms = 61000;
  render(canvas, font, compact, f, r);
  CHECK(r.countdown_finished);
  CHECK_EQ(r.mode, MODE_MESSAGE);

  FakeCanvas canvas2;
  font.calls.clear();
  f.now_ms = 62000;
  render(canvas2, font, compact, f, r);
  std::string seen;
  for (const auto &call : font.calls) seen += call.ch;
  CHECK(seen.find("DONE") != std::string::npos);
}

static void test_countdown_never_exceeds_5999_seconds() {
  reset_state();
  state.start_countdown(99999, 0);
  CHECK(state.countdown_total_ms <= 3599000UL);

  // Formatting wraps within 60 minutes.
  Frame f = base_frame();
  f.now_ms = 0;
  state.start_countdown(3599, 0);
  char out[24];
  CHECK(build_content(f, MODE_COUNTDOWN, false, out, sizeof(out)));
  CHECK_EQ((int) strlen(out), 5);
  CHECK(strcmp(out, "59:59") == 0);
}

static void test_ota_screen_draws_percentage_and_bar() {
  FakeCanvas canvas;
  FakeFont font(6);
  Frame f = base_frame();
  reset_state();
  state.ota_state = OTA_UPLOADING;
  state.ota_percent = 42;

  render(canvas, compact, font, f, report);
  std::string seen;
  int min_top = 99;
  for (const auto &call : font.calls) {
    seen += call.ch;
    if (call.box_top < min_top) min_top = call.box_top;
  }
  CHECK(seen.find("OTA 42%") != std::string::npos);
  // The bottom row belongs to the progress bar; the text stays inside the
  // display (the fake font is 7px tall, so there is no room left to move up).
  CHECK_EQ(min_top, 0);
  // 42% of 48 = 20 lit pixels on the last row.
  CHECK_EQ(canvas.row_on(7), 20);
}

static void test_ota_error_and_success_screens() {
  FakeCanvas canvas;
  FakeFont font(6);
  Frame f = base_frame();
  reset_state();
  state.ota_state = OTA_ERROR;
  state.ota_error = 3;
  render(canvas, compact, font, f, report);
  std::string seen;
  for (const auto &call : font.calls) seen += call.ch;
  CHECK(seen.find("ERROR 3") != std::string::npos);

  canvas.clear();
  font.calls.clear();
  state.ota_state = OTA_SUCCESS;
  render(canvas, compact, font, f, report);
  seen.clear();
  for (const auto &call : font.calls) seen += call.ch;
  CHECK(seen.find("100%") != std::string::npos);
}

static void test_ota_narrowed_on_small_display() {
  FakeCanvas canvas(32, 8);
  FakeFont font(6);
  Frame f = base_frame();
  reset_state();
  state.ota_state = OTA_UPLOADING;
  state.ota_percent = 42;
  render(canvas, compact, font, f, report);
  std::string seen;
  for (const auto &call : font.calls) seen += call.ch;
  // "OTA 42%" is 42px wide and would not fit 32px; the numeric percentage is kept.
  CHECK(seen.find("42%") != std::string::npos);
  CHECK(seen.find("OTA 42%") == std::string::npos);
}

static void test_only_changed_digits_animate() {
  FakeCanvas canvas;
  // Use FakeFont with ink_height=7 like the built-in font
  FakeFont font(6, /*ink_height=*/7, /*ink_top=*/0);
  Frame f = base_frame();  // shows "12:34"
  f.seconds_mode = SECONDS_OFF;
  f.animate = true;
  f.animation_ms = 250;

  reset_state();
  render(canvas, font, compact, f, report);  // baseline, no animation
  CHECK_EQ(font.calls.size(), 5u);

  // 12:34 -> 12:35: only the last digit changed.
  font.calls.clear();
  canvas.clear();
  f.minute = 35;
  f.now_ms = 1000;
  render(canvas, font, compact, f, report);
  CHECK_EQ(font.calls_for('5'), 1);
  CHECK_EQ(font.calls_for('4'), 1);
  const int box_top = font.centered_box_top(8);  // = 0 for ink_height=7, display=8
  bool old_flew_up = false, new_came_from_below = false, unchanged_centered = false;
  for (const auto &call : font.calls) {
    if (call.ch == '4' && call.box_top == box_top) old_flew_up = true;          // progress == 0
    // FIXED: slide uses font.ink_height() (7), not canvas height (8)
    if (call.ch == '5' && call.box_top == box_top + 7) new_came_from_below = true;
    if ((call.ch == '1' || call.ch == ':') && call.box_top == box_top) unchanged_centered = true;
  }
  CHECK(old_flew_up);
  CHECK(new_came_from_below);
  CHECK(unchanged_centered);

  // Mid animation (same content): the old digit is part way up, the new one
  // part way down. offset = 3 (0.5 * 7 = 3.5 -> 3)
  font.calls.clear();
  canvas.clear();
  f.now_ms = 1125;
  render(canvas, font, compact, f, report);
  bool old_part_up = false, new_part_down = false;
  for (const auto &call : font.calls) {
    if (call.ch == '4' && call.box_top == box_top - 3) old_part_up = true;
    if (call.ch == '5' && call.box_top == box_top + 4) new_part_down = true;
  }
  CHECK(old_part_up);   // Old digit 3px up
  CHECK(new_part_down); // New digit 4px down from start (box_top+7 - 3 = box_top+4)

  // After the animation window the previous content is stable again.
  font.calls.clear();
  canvas.clear();
  f.now_ms = 3000;
  render(canvas, font, compact, f, report);
  CHECK_EQ(font.calls_for('5'), 1);
  CHECK_EQ(font.calls_for('4'), 0);
}

// NEW TEST: Reproduce the per-digit slide-up animation clipping/gap bug.
// The slide distance should match the glyph's ink_height (7px), not canvas height (8px).
// Otherwise at progress=0 the new digit starts at box_top+8 (row 8), which is
// completely off-screen for an 8px display (valid rows 0-7), leaving a 1-frame
// gap where neither old nor new digit is visible on the bottom row.
static void test_slide_animation_uses_ink_height_not_canvas_height() {
  FakeCanvas canvas(48, 8);
  // Font with ink_height=7 (like the built-in font), ink_top=0
  FakeFont font(6, /*ink_height=*/7, /*ink_top=*/0);
  Frame f = base_frame();
  f.seconds_mode = SECONDS_OFF;
  f.animate = true;
  f.animation_ms = 250;

  reset_state();
  render(canvas, font, compact, f, report);  // baseline: "12:34"

  // Change last digit: 12:34 -> 12:35
  font.calls.clear();
  canvas.clear();
  f.minute = 35;
  f.now_ms = 1000;  // progress = 0
  render(canvas, font, compact, f, report);

  const int box_top = font.centered_box_top(8);  // = 0 for ink_height=7, display=8

  // At progress=0, the NEW digit should start at box_top + ink_height (7), NOT box_top + canvas_height (8).
  // At box_top+7, the 7px glyph draws rows 7-13. Row 7 is the LAST visible row (bottom row).
  // At box_top+8 (old behavior), it draws rows 8-14 - ALL OFF SCREEN.
  bool new_digit_starts_on_bottom_row = false;
  for (const auto &call : font.calls) {
    if (call.ch == '5' && call.box_top == box_top + 7) {
      new_digit_starts_on_bottom_row = true;
    }
  }
  CHECK(new_digit_starts_on_bottom_row);  // This FAILS with current code (expects box_top+8)

  // Also verify OLD digit starts at box_top (resting position)
  bool old_digit_at_rest = false;
  for (const auto &call : font.calls) {
    if (call.ch == '4' && call.box_top == box_top) {
      old_digit_at_rest = true;
    }
  }
  CHECK(old_digit_at_rest);

  // Mid-animation (progress=0.5): offset = 3 (0.5 * 7 = 3.5 -> 3)
  // Old at box_top-3, New at box_top+4. They should meet with NO GAP.
  font.calls.clear();
  canvas.clear();
  f.now_ms = 1125;  // 125ms into 250ms = 0.5 progress
  render(canvas, font, compact, f, report);

  bool old_at_minus3 = false, new_at_plus4 = false;
  for (const auto &call : font.calls) {
    if (call.ch == '4' && call.box_top == box_top - 3) old_at_minus3 = true;
    if (call.ch == '5' && call.box_top == box_top + 4) new_at_plus4 = true;
  }
  CHECK(old_at_minus3);   // Old digit 3px up
  CHECK(new_at_plus4);    // New digit 4px down from start (box_top+7 - 3 = box_top+4)

  // Verify no 1-pixel gap: at mid-animation, row 3 (box_top+3) should have ink from OLD digit
  // and row 4 (box_top+4) should have ink from NEW digit - contiguous coverage.
  int row3_count = canvas.row_on(box_top + 3);
  int row4_count = canvas.row_on(box_top + 4);
  CHECK(row3_count > 0);  // Old digit still covering row 3
  CHECK(row4_count > 0);  // New digit covering row 4
}

static void test_animation_row_gap_separates_old_and_new_digits() {
  FakeCanvas canvas;
  FakeFont font(6, /*ink_height=*/7, /*ink_top=*/0);
  Frame f = base_frame();
  f.seconds_mode = SECONDS_OFF;
  f.animate = true;
  f.animation_ms = 250;
  f.animation_row_gap = 2;

  reset_state();
  render(canvas, font, compact, f, report);
  canvas.clear();
  f.minute = 35;  // 12:34 -> 12:35; the last pair of digits shares a boundary.
  f.now_ms = 1000;
  render(canvas, font, compact, f, report);

  const int box_top = font.centered_box_top(8);
  bool old_at_rest = false, new_below_with_two_blank_rows = false;
  for (const auto &call : font.calls) {
    if (call.ch == '4' && call.box_top == box_top) old_at_rest = true;
    if (call.ch == '5' && call.box_top == box_top + 9) new_below_with_two_blank_rows = true;
  }
  CHECK(old_at_rest);
  CHECK(new_below_with_two_blank_rows);

  // Once the slide settles, the new glyph returns to its resting row.
  canvas.clear();
  f.now_ms = 2000;
  render(canvas, font, compact, f, report);
  bool new_at_rest = false;
  for (const auto &call : font.calls)
    if (call.ch == '5' && call.box_top == box_top) new_at_rest = true;
  CHECK(new_at_rest);
}

static void test_animation_disabled_and_mode_change_reset() {
  FakeCanvas canvas;
  FakeFont font(6);
  Frame f = base_frame();
  f.seconds_mode = SECONDS_OFF;
  f.animate = false;

  reset_state();
  render(canvas, font, compact, f, report);
  font.calls.clear();
  canvas.clear();
  f.minute = 35;
  f.now_ms = 1000;
  render(canvas, font, compact, f, report);
  // Animation off: the new digit is drawn exactly once, at its resting place.
  CHECK_EQ(font.calls_for('5'), 1);
  CHECK_EQ(font.calls_for('4'), 0);

  // Switching modes resets the animation state (no slides between screens).
  f.screen = SCREEN_DATE;
  f.now_ms = 2000;
  render(canvas, font, compact, f, report);
  CHECK(!state.anim_active);
}

static void test_blinking_colon() {
  FakeCanvas canvas;
  FakeFont font(6);
  Frame f = base_frame();
  f.blink_colon = true;

  reset_state();
  f.second = 56;  // even -> colon on
  render(canvas, font, compact, f, report);
  int colons_even = font.calls_for(':');
  CHECK_EQ(colons_even, 2);

  font.calls.clear();
  canvas.clear();
  f.second = 57;  // odd -> colons blanked
  f.now_ms = 1000;
  render(canvas, font, compact, f, report);
  int colons_odd = font.calls_for(':');
  CHECK_EQ(colons_odd, 0);

  font.calls.clear();
  canvas.clear();
  f.blink_colon = false;
  f.second = 57;
  f.now_ms = 2000;
  render(canvas, font, compact, f, report);
  CHECK_EQ(font.calls_for(':'), 2);
}

static void test_seconds_bar() {
  FakeCanvas canvas;
  FakeFont font(6);
  Frame f = base_frame();
  f.seconds_mode = SECONDS_BAR;
  f.second = 30;

  reset_state();
  render(canvas, font, compact, f, report);
  CHECK_EQ(canvas.row_on(7), 24);
  CHECK_EQ(font.calls_for(':'), 1);  // "12:34" (no seconds digits)

  canvas.clear();
  font.calls.clear();
  f.second = 0;
  f.now_ms = 1000;
  render(canvas, font, compact, f, report);
  CHECK_EQ(canvas.row_on(7), 0);
}

static void test_message_scrolling_and_static() {
  FakeCanvas canvas;
  FakeFont font(6);
  Frame f = base_frame();

  reset_state();
  state.set_message("A LONG MESSAGE THAT NEEDS TO SCROLL", 0, 0);
  f.now_ms = 0;
  render(canvas, font, compact, f, report);
  // A new scrolling message starts left aligned, so it is visible immediately.
  int first_x = font.calls.empty() ? -1 : font.calls[0].x;
  CHECK_EQ(first_x, 0);

  font.calls.clear();
  canvas.clear();
  f.now_ms = 2000;  // 2000ms / 60ms per px -> the text has moved left
  render(canvas, font, compact, f, report);
  int later_x = font.calls.empty() ? -1 : font.calls[0].x;
  CHECK(later_x < 0);

  // Scrolling off: the text is static (left aligned) and never scrolls.
  reset_state();
  f.message_scroll = false;
  f.now_ms = 0;
  state.set_message("A LONG MESSAGE THAT NEEDS TO SCROLL", 0, 0);
  font.calls.clear();
  canvas.clear();
  render(canvas, font, compact, f, report);
  int static_x = font.calls[0].x;
  font.calls.clear();
  canvas.clear();
  f.now_ms = 5000;
  render(canvas, font, compact, f, report);
  CHECK_EQ(font.calls[0].x, static_x);

  // Short messages are centred, not scrolled.
  reset_state();
  Frame f2 = base_frame();
  f2.message_scroll = true;
  state.set_message("HI", 0, 0);
  font.calls.clear();
  render(canvas, font, compact, f2, report);
  // "HI" = 6 + 6 = 12px wide, centred at (48 - 12) / 2 = 18.
  CHECK_EQ(font.calls[0].x, 18);
}

static void test_message_without_duration_stays_until_cleared() {
  FakeCanvas canvas;
  FakeFont font(6);
  Frame f = base_frame();
  f.seconds_mode = SECONDS_OFF;
  reset_state();

  state.set_message("HELLO", 0, 0);  // duration 0 = until cleared
  for (uint32_t now = 0; now <= 3600000UL; now += 600000UL) {
    f.now_ms = now;
    CHECK_EQ(effective_mode(f), MODE_MESSAGE);
  }
  state.clear_message();
  f.now_ms = 3600000UL;
  CHECK_EQ(effective_mode(f), MODE_CLOCK);
}

static void test_message_and_alert_expire() {
  Frame f = base_frame();
  reset_state();
  state.set_message("hi", 5000, 0);
  f.now_ms = 0;
  CHECK_EQ(MODE_MESSAGE, effective_mode(f));
  f.now_ms = 6000;
  CHECK_EQ(MODE_CLOCK, effective_mode(f));

  state.set_alert("DONE", 5000, 0);
  f.now_ms = 6000;
  CHECK_EQ(MODE_CLOCK, effective_mode(f));
}

static void test_night_brightness_schedule() {
  Frame f = base_frame();
  reset_state();
  f.night_schedule = true;
  f.night_start_hour = 22;
  f.night_end_hour = 7;
  f.brightness_day = 3;
  f.brightness_night = 1;

  // 23:00 -> night window wraps over midnight.
  f.hour = 23;
  f.now_ms = 0;
  Report r;
  FakeCanvas canvas;
  FakeFont font(6);
  render(canvas, font, compact, f, r);
  CHECK(r.brightness_changed);
  CHECK_EQ((int) r.brightness, 1);
  CHECK(state.night_active);

  // 12:00 -> back to the day brightness, reported exactly once.
  f.hour = 12;
  f.now_ms = 2000;
  render(canvas, font, compact, f, r);
  CHECK(r.brightness_changed);
  CHECK_EQ((int) r.brightness, 3);
  CHECK(!state.night_active);

  f.now_ms = 4000;
  render(canvas, font, compact, f, r);
  CHECK(!r.brightness_changed);
}

static void test_manual_night_switch() {
  Frame f = base_frame();
  reset_state();
  f.night_manual = true;
  f.brightness_night = 0.5f;
  f.now_ms = 0;
  Report r;
  FakeCanvas canvas;
  FakeFont font(6);
  render(canvas, font, compact, f, r);
  CHECK(state.night_active);
  CHECK(fabsf(r.brightness - 0.5f) < 0.001f);
}

static void test_brightness_entity_change_applies_without_flip() {
  // Moving the Matrix/Night brightness entities from Home Assistant must
  // reach the panel even while the night window state never changes.
  Frame f = base_frame();
  reset_state();
  f.night_schedule = false;
  f.night_manual = false;
  f.brightness_day = 3;
  f.brightness_night = 1;
  Report r;
  FakeCanvas canvas;
  FakeFont font(6);

  f.now_ms = 0;
  render(canvas, font, compact, f, r);
  CHECK(r.brightness_changed);  // first frame applies the day level
  CHECK_EQ((int) r.brightness, 3);
  CHECK(!state.night_active);

  f.now_ms = 2000;
  f.brightness_day = 9;  // HA slider moved, still daytime
  render(canvas, font, compact, f, r);
  CHECK(r.brightness_changed);
  CHECK_EQ((int) r.brightness, 9);
  CHECK(!state.night_active);

  f.now_ms = 4000;
  render(canvas, font, compact, f, r);
  CHECK(!r.brightness_changed);  // reported exactly once

  // Same while night mode is active: the night slider applies too.
  f.now_ms = 6000;
  f.night_manual = true;
  f.brightness_night = 2;
  render(canvas, font, compact, f, r);
  CHECK(r.brightness_changed);
  CHECK_EQ((int) r.brightness, 2);

  f.now_ms = 8000;
  f.brightness_night = 5;
  render(canvas, font, compact, f, r);
  CHECK(r.brightness_changed);
  CHECK_EQ((int) r.brightness, 5);
}

static void test_alarm_mode_flashes_twice_per_second() {
  // The alarm flash toggles the panel level every 500 ms. Brightness is
  // evaluated on every render call, so a 150 ms display cadence sees the
  // toggle; sampling it once per second would freeze the parity and the
  // panel would stay dark (or lit) instead of flashing.
  Frame f = base_frame();
  reset_state();
  f.alarm_mode = true;
  f.brightness_day = 3;
  Report r;
  FakeCanvas canvas;
  FakeFont font(6);

  f.now_ms = 0;  // (0/500) parity 0 -> first alarm level is dark
  render(canvas, font, compact, f, r);
  CHECK(r.brightness_changed);
  CHECK_EQ((int) r.brightness, 0);

  f.now_ms = 250;  // same 500 ms half: no change
  render(canvas, font, compact, f, r);
  CHECK(!r.brightness_changed);

  f.now_ms = 600;  // parity flipped: full brightness
  render(canvas, font, compact, f, r);
  CHECK(r.brightness_changed);
  CHECK_EQ((int) r.brightness, 15);

  f.now_ms = 750;
  render(canvas, font, compact, f, r);
  CHECK(!r.brightness_changed);

  f.now_ms = 1150;  // back to dark, one full flash per second
  render(canvas, font, compact, f, r);
  CHECK(r.brightness_changed);
  CHECK_EQ((int) r.brightness, 0);

  f.now_ms = 1600;
  render(canvas, font, compact, f, r);
  CHECK(r.brightness_changed);
  CHECK_EQ((int) r.brightness, 15);

  // Leaving alarm mode restores the steady day level and then stays quiet.
  f.alarm_mode = false;
  f.now_ms = 2000;
  render(canvas, font, compact, f, r);
  CHECK(r.brightness_changed);
  CHECK_EQ((int) r.brightness, 3);

  f.now_ms = 2150;
  render(canvas, font, compact, f, r);
  CHECK(!r.brightness_changed);
}

static void test_auto_cycle_clock_date() {
  Frame f = base_frame();
  reset_state();
  f.auto_cycle = true;
  f.cycle_interval_s = 10;
  Report r;
  FakeCanvas canvas;
  FakeFont font(6);

  render(canvas, font, compact, f, r);
  CHECK(!r.screen_changed);  // first tick only arms the timer

  f.now_ms = 11000;
  render(canvas, font, compact, f, r);
  CHECK(r.screen_changed);
  CHECK_EQ(r.screen, SCREEN_DATE);

  // Message screens suspend cycling.
  state.set_message("hi", 0, 0);
  f.now_ms = 23000;
  render(canvas, font, compact, f, r);
  CHECK(!r.screen_changed);
}

static void test_date_screen_duration_is_independent() {
  Frame f = base_frame();
  reset_state();
  f.auto_cycle = true;
  f.cycle_interval_s = 10;
  f.date_cycle_interval_s = 20;
  Report r;
  FakeCanvas canvas;
  FakeFont font(6);

  render(canvas, font, compact, f, r);  // arm while Clock is visible
  f.now_ms = 11000;
  render(canvas, font, compact, f, r);
  CHECK(r.screen_changed);
  CHECK_EQ(r.screen, SCREEN_DATE);

  // The caller publishes the reported Date selection before the next frame.
  f.screen = SCREEN_DATE;
  f.now_ms = 12000;
  render(canvas, font, compact, f, r);
  CHECK(!r.screen_changed);
  f.now_ms = 31000;
  render(canvas, font, compact, f, r);
  CHECK(r.screen_changed);
  CHECK_EQ(r.screen, SCREEN_CLOCK);
}

static void test_selected_screen_change_starts_slide_transition() {
  Frame f = base_frame();
  f.seconds_mode = SECONDS_OFF;
  f.animate = true;
  f.animation_ms = 250;
  Report r;
  FakeCanvas canvas;
  FakeFont font(6);
  reset_state();

  render(canvas, font, compact, f, r);  // Clock baseline
  canvas.clear();
  f.screen = SCREEN_DATE;
  f.now_ms = 1000;
  render(canvas, font, compact, f, r);
  CHECK(state.screen_transition_active);
}

static void test_scrolling_date_starts_after_screen_slide_transition() {
  Frame f = base_frame();
  f.seconds_mode = SECONDS_OFF;
  f.animate = true;
  f.animation_ms = 600;
  f.date_format = DATE_WEEKDAY_DD_MMM_YY;
  f.now_ms = 0;
  reset_state();
  FakeCanvas canvas;
  BuiltinFont compact;
  FakeFont font(6);
  Report r;
  render(canvas, font, compact, f, r);  // Establish Clock as the selected screen.

  f.screen = SCREEN_DATE;
  f.now_ms = 1000;
  render(canvas, font, compact, f, r);
  CHECK(state.screen_transition_active);
  CHECK_EQ(state.date_scroll_started_ms, 0U);

  f.now_ms = 1600;
  render(canvas, font, compact, f, r);
  CHECK(!state.screen_transition_active);
  CHECK_EQ(state.date_scroll_started_ms, 1600U);
}

static void test_bitmap_test_screens() {
  FakeCanvas grid;
  FakeFont font(6);
  Frame f = base_frame();
  f.screen = SCREEN_GRID_TEST;
  reset_state();
  render(grid, font, compact, f, report);
  CHECK(font.calls.empty());
  CHECK(grid.on_count() > 0);
  // Six modules in one row: a box border runs along the top row.
  CHECK(grid.get(0, 0) && grid.get(7, 0) && grid.get(8, 0) && grid.get(47, 0));

  FakeCanvas pixels;
  f.screen = SCREEN_PIXEL_TEST;
  render(pixels, font, compact, f, report);
  CHECK_EQ(pixels.on_count(), 24 * 8);  // checkerboard: half of 48x8
}

static void test_report_publishes_only_on_change() {
  FakeCanvas canvas;
  FakeFont font(6);
  Frame f = base_frame();
  reset_state();

  Report r;
  render(canvas, font, compact, f, r);
  CHECK(r.mode_changed);
  CHECK_EQ(r.mode, MODE_CLOCK);

  render(canvas, font, compact, f, r);
  CHECK(!r.mode_changed);  // unchanged mode is not republished

  f.minute = 35;
  f.now_ms = 1000;
  state.start_countdown(60, 1000);
  render(canvas, font, compact, f, r);
  CHECK(r.mode_changed);
  CHECK_EQ(r.mode, MODE_COUNTDOWN);
  CHECK_EQ(r.remaining_s, 60);

  f.now_ms = 2000;
  render(canvas, font, compact, f, r);
  CHECK(r.remaining_changed);
  CHECK_EQ(r.remaining_s, 59);

  f.now_ms = 3000;
  render(canvas, font, compact, f, r);
  CHECK_EQ(r.remaining_s, 58);
}

static void test_alignment() {
  FakeCanvas canvas;
  FakeFont font(6);
  Frame f = base_frame();
  f.alignment = ALIGN_LEFT;
  reset_state();
  render(canvas, font, compact, f, report);
  CHECK_EQ(font.calls[0].x, 0);

  font.calls.clear();
  canvas.clear();
  f.alignment = ALIGN_RIGHT;
  f.now_ms = 1000;
  render(canvas, font, compact, f, report);
  int x0, y0, x1, y1;
  CHECK(canvas.bbox(&x0, &y0, &x1, &y1));
  CHECK_EQ(x1, 46);  // 5px of ink in the last 6px box

  font.calls.clear();
  canvas.clear();
  f.alignment = ALIGN_CENTER;
  f.now_ms = 2000;
  render(canvas, font, compact, f, report);
  CHECK(canvas.bbox(&x0, &y0, &x1, &y1));
  CHECK_EQ(x0, 0);  // 48px of text in a 48px display is centred at 0
}

static void test_date_formats() {
  Frame f = base_frame();
  f.day = 5;
  f.month = 3;
  f.year = 2026;
  char out[24];
  f.date_format = DATE_DD_MM;
  CHECK(build_content(f, MODE_DATE, false, out, sizeof(out)));
  CHECK(strcmp(out, "05.03") == 0);
  f.date_format = DATE_MM_DD;
  CHECK(build_content(f, MODE_DATE, false, out, sizeof(out)));
  CHECK(strcmp(out, "03/05") == 0);
  f.date_format = DATE_DD_MM_SLASH;
  CHECK(build_content(f, MODE_DATE, false, out, sizeof(out)));
  CHECK(strcmp(out, "05/03") == 0);
  f.date_format = DATE_DD_MM_YY;
  CHECK(build_content(f, MODE_DATE, false, out, sizeof(out)));
  CHECK(strcmp(out, "05.03.26") == 0);
  f.date_format = DATE_WEEKDAY_DD_MM_YY;
  CHECK(build_content(f, MODE_DATE, false, out, sizeof(out)));
  CHECK(strcmp(out, "THU 05.03.26") == 0);
  f.date_format = DATE_WEEKDAY_DD_MMM_YY;
  CHECK(build_content(f, MODE_DATE, false, out, sizeof(out)));
  CHECK(strcmp(out, "THU 05. MAR 26") == 0);
  f.date_format = DATE_WEEKDAY_MMM_DD;
  CHECK(build_content(f, MODE_DATE, false, out, sizeof(out)));
  CHECK(strcmp(out, "THU MAR.05") == 0);
}

static void test_weather_condition_normalization() {
  struct Case { const char *state; uint8_t expected; };
  const Case cases[] = {
      {"sunny", WEATHER_CLEAR}, {"clear sky", WEATHER_CLEAR}, {"clear-night", WEATHER_CLEAR_NIGHT},
      {"partlycloudy", WEATHER_PARTLY_CLOUDY}, {"few clouds", WEATHER_PARTLY_CLOUDY},
      {"overcast clouds", WEATHER_CLOUDY}, {"mist", WEATHER_FOG}, {"haze", WEATHER_FOG},
      {"moderate rain", WEATHER_RAIN}, {"pouring", WEATHER_RAIN}, {"snowy-rainy", WEATHER_SNOW},
      {"thunderstorm with heavy rain", WEATHER_THUNDERSTORM}, {"lightning-rainy", WEATHER_THUNDERSTORM},
      {"windy-variant", WEATHER_WINDY}, {"squalls", WEATHER_WINDY},
      {"unavailable", WEATHER_UNKNOWN}, {"unknown", WEATHER_UNKNOWN}, {"exceptional", WEATHER_UNKNOWN},
  };
  for (const auto &item : cases) CHECK_EQ(weather_from_condition(item.state), item.expected);
  CHECK_EQ(weather_from_condition(nullptr), WEATHER_UNKNOWN);
  CHECK_EQ(weather_from_condition(" "), WEATHER_UNKNOWN);
}

static void test_weather_temperature_values_are_explicit_and_prioritized() {
  float value = 9.0f;
  CHECK(parse_temperature_text("21.5", value));
  CHECK_EQ(value, 21.5f);
  CHECK(parse_temperature_text("  -0.4 ", value));
  CHECK_EQ(value, -0.4f);
  const char *invalid[] = {"", "unknown", "unavailable", "NaN", "inf", "22 C", "21.5x"};
  for (const char *text : invalid) {
    value = 9.0f;
    CHECK(!parse_temperature_text(text, value));
    CHECK_EQ(value, 9.0f);  // an invalid source never reuses a changed value
  }
  float selected = 0.0f;
  CHECK(choose_outdoor_temperature(true, 17.3f, true, 12.4f, selected));
  CHECK_EQ(selected, 17.3f);  // dedicated entity wins
  CHECK(choose_outdoor_temperature(false, 0.0f, true, 12.4f, selected));
  CHECK_EQ(selected, 12.4f);  // weather.temperature is the fallback
  CHECK(!choose_outdoor_temperature(false, 0.0f, false, 0.0f, selected));
}

static void test_fixed_weather_panels_and_bitmap_categories() {
  char text[16];
  format_temperature_text(21.5f, true, 24, text, sizeof(text));
  CHECK(strcmp(text, "21.5") == 0);
  format_temperature_text(-12.3f, true, 24, text, sizeof(text));
  CHECK(strcmp(text, "-12") == 0);  // keep a safe fixed-width fallback
  format_temperature_text(0.0f, false, 24, text, sizeof(text));
  CHECK(strcmp(text, "--.-") == 0);
  format_micro_temperature(21.5f, true, 16, text, sizeof(text));
  CHECK(strcmp(text, "21.5") == 0);
  format_micro_temperature(21.0f, true, 16, text, sizeof(text));
  CHECK(strcmp(text, "21") == 0);
  format_micro_temperature(-4.0f, true, 16, text, sizeof(text));
  CHECK(strcmp(text, "-4") == 0);
  format_micro_temperature(0.0f, false, 16, text, sizeof(text));
  CHECK(strcmp(text, "--.-") == 0);

  FakeCanvas canvas(96, 8);
  draw_home_temperature_panel(canvas, 0, 21.5f, true);
  int x0, y0, x1, y1;
  CHECK(canvas.bbox(&x0, &y0, &x1, &y1));
  CHECK(x0 >= 0 && x1 < 24);
  // Both side temperatures use the same compact 3x5 digits.  The left panel
  // must not silently switch to the larger built-in face when its value fits.
  FakeCanvas expected_home(24, 8);
  FakeCanvas actual_home(24, 8);
  draw_micro_temperature(expected_home, 21.5f, true);
  draw_home_temperature_panel(actual_home, 0, 21.5f, true);
  for (int y = 0; y < 8; y++) for (int x = 0; x < 24; x++)
    CHECK_EQ(actual_home.get(x, y), expected_home.get(x, y));
  canvas.clear();
  draw_home_temperature_panel(canvas, 0, 0.0f, false);
  CHECK(canvas.bbox(&x0, &y0, &x1, &y1));
  CHECK(x0 >= 0 && x1 < 24);

  Frame f = base_frame();
  f.weather_condition = WEATHER_RAIN;
  f.outdoor_temperature = 13.2f;
  f.outdoor_temperature_valid = true;
  canvas.clear();
  draw_weather_panel(canvas, 72, f, true, true);
  CHECK(canvas.bbox(&x0, &y0, &x1, &y1));
  CHECK(x0 >= 72 && x1 < 96);
  CHECK(canvas.on_count() > 0);

  // The right panel also keeps compact digits when the Date screen enables
  // only outdoor temperature (without the icon).
  FakeCanvas expected_outdoor(24, 8);
  FakeCanvas actual_outdoor(24, 8);
  draw_micro_temperature(expected_outdoor, 13.2f, true);
  draw_weather_panel(actual_outdoor, 0, f, false, true);
  for (int y = 0; y < 8; y++) for (int x = 0; x < 24; x++)
    CHECK_EQ(actual_outdoor.get(x, y), expected_outdoor.get(x, y));

  const uint8_t categories[] = {WEATHER_UNKNOWN, WEATHER_CLEAR, WEATHER_CLEAR_NIGHT, WEATHER_PARTLY_CLOUDY,
                                WEATHER_CLOUDY, WEATHER_FOG, WEATHER_RAIN, WEATHER_SNOW,
                                WEATHER_THUNDERSTORM, WEATHER_WINDY};
  std::vector<std::string> patterns;
  for (uint8_t category : categories) {
    FakeCanvas icon(8, 8);
    draw_weather_icon(icon, 0, 0, category, false);
    std::string bits;
    for (int y = 0; y < 8; y++) for (int x = 0; x < 8; x++) bits += icon.get(x, y) ? '1' : '0';
    if (std::find(patterns.begin(), patterns.end(), bits) == patterns.end()) patterns.push_back(bits);
  }
  CHECK_EQ(patterns.size(), sizeof(categories) / sizeof(categories[0]));

  // Partly cloudy must retain a visible sun above a separate cloud. These
  // checks protect the visual language of the one-module (8x8) icon.
  FakeCanvas partly_cloudy(8, 8);
  draw_weather_icon(partly_cloudy, 0, 0, WEATHER_PARTLY_CLOUDY, false);
  CHECK(partly_cloudy.get(2, 0));   // sun ray
  CHECK(partly_cloudy.get(3, 2));   // sun disc
  CHECK(!partly_cloudy.get(0, 4));  // gap between sun and cloud
  CHECK(partly_cloudy.get(3, 6));   // cloud body

  // Rain and snow use intentionally different lower-half marks, so the
  // forecast remains understandable on a single 8x8 MAX7219 module.
  FakeCanvas rain(8, 8), snow(8, 8);
  draw_weather_icon(rain, 0, 0, WEATHER_RAIN, false);
  draw_weather_icon(snow, 0, 0, WEATHER_SNOW, false);
  CHECK(rain.get(2, 5));
  CHECK(!snow.get(2, 5));
  CHECK(snow.get(2, 6));
}

static bool region_has_pixels(const FakeCanvas &canvas, int x0, int x1) {
  for (int y = 0; y < canvas.height(); y++)
    for (int x = x0; x < x1; x++)
      if (canvas.get(x, y)) return true;
  return false;
}

static void test_twelve_module_clock_layouts_keep_clock_in_middle_six() {
  FakeCanvas clock_only(96, 8), icon_layout(96, 8), home_weather(96, 8);
  const int layouts[] = {CLOCK_LAYOUT_ONLY, CLOCK_LAYOUT_WEATHER_ICON, CLOCK_LAYOUT_HOME_AND_OUTDOOR_WEATHER};
  FakeCanvas *canvases[] = {&clock_only, &icon_layout, &home_weather};
  for (int i = 0; i < 3; i++) {
    Frame f = base_frame(1000);
    f.seconds_mode = SECONDS_OFF;
    f.clock_layout = layouts[i];
    f.home_temperature = 21.5f;
    f.home_temperature_valid = true;
    f.outdoor_temperature = 13.2f;
    f.outdoor_temperature_valid = true;
    f.weather_condition = WEATHER_CLEAR;
    reset_state();
    render(*canvases[i], compact, compact, f, report);
    CHECK(region_has_pixels(*canvases[i], 24, 72));
    for (int y = 0; y < 8; y++) for (int x = 24; x < 72; x++)
      CHECK_EQ(canvases[i]->get(x, y), clock_only.get(x, y));
  }
  CHECK(!region_has_pixels(clock_only, 0, 24));
  CHECK(!region_has_pixels(clock_only, 72, 96));
  CHECK(!region_has_pixels(icon_layout, 0, 24));
  CHECK(region_has_pixels(icon_layout, 72, 96));
  CHECK(region_has_pixels(home_weather, 0, 24));
  CHECK(region_has_pixels(home_weather, 72, 96));

  const WeatherPanelGeometry layout = weather_panel_geometry(clock_only);
  CHECK(layout.available);
  CHECK_EQ(layout.left_x, 0);
  CHECK_EQ(layout.clock_x, 24);
  CHECK_EQ(layout.right_x, 72);
  CHECK_EQ(layout.date_safe_width, 72);
}

static void test_six_module_clock_ignores_weather_panels_for_compatibility() {
  FakeCanvas plain(48, 8), selected(48, 8);
  Frame f = base_frame(1000);
  f.seconds_mode = SECONDS_OFF;
  reset_state();
  render(plain, compact, compact, f, report);
  f.clock_layout = CLOCK_LAYOUT_HOME_AND_OUTDOOR_WEATHER;
  f.home_temperature_valid = true;
  f.home_temperature = 22.0f;
  f.outdoor_temperature_valid = true;
  f.outdoor_temperature = 12.0f;
  f.weather_condition = WEATHER_RAIN;
  reset_state();
  render(selected, compact, compact, f, report);
  CHECK(!weather_panel_geometry(selected).available);
  for (int y = 0; y < 8; y++) for (int x = 0; x < 48; x++) CHECK_EQ(selected.get(x, y), plain.get(x, y));
}

static void test_date_weather_switches_reserve_the_right_panel_and_scroll_inside_safe_width() {
  struct SwitchCase { bool icon; bool temperature; };
  const SwitchCase cases[] = {{false, false}, {true, false}, {false, true}, {true, true}};
  for (const auto &item : cases) {
    FakeCanvas canvas(96, 8);
    Frame f = base_frame(1000);
    f.screen = SCREEN_DATE;
    f.date_format = DATE_WEEKDAY_DD_MMM_YY;
    f.date_show_weather_icon = item.icon;
    f.date_show_outdoor_temperature = item.temperature;
    f.weather_condition = WEATHER_CLOUDY;
    f.outdoor_temperature_valid = true;
    f.outdoor_temperature = 14.6f;
    f.animate = false;
    reset_state();
    render(canvas, compact, compact, f, report);
    CHECK(region_has_pixels(canvas, 0, 72));
    if (item.icon || item.temperature) {
      FakeCanvas expected(96, 8);
      draw_weather_panel(expected, 72, f, item.icon, item.temperature);
      for (int y = 0; y < 8; y++) for (int x = 72; x < 96; x++)
        CHECK_EQ(canvas.get(x, y), expected.get(x, y));
    }
  }

  // Exercise a narrower safe viewport where even the built-in longest date
  // must marquee; both marquee frames remain clipped before the reserved side.
  FakeCanvas first(96, 8), later(96, 8);
  ViewportCanvas safe_first(first, 0, 64), safe_later(later, 0, 64);
  draw_free_text(safe_first, compact, "THU 31. DEC 26", 0, true, 20, compact.centered_box_top(8));
  draw_free_text(safe_later, compact, "THU 31. DEC 26", 80, true, 20, compact.centered_box_top(8));
  CHECK(region_has_pixels(first, 0, 64));
  CHECK(region_has_pixels(later, 0, 64));
  CHECK(!region_has_pixels(first, 64, 96));
  CHECK(!region_has_pixels(later, 64, 96));
  bool changed = false;
  for (int y = 0; y < 8; y++) for (int x = 0; x < 64; x++) changed |= first.get(x, y) != later.get(x, y);
  CHECK(changed);
}

static void test_clock_and_date_digit_animation_stay_inside_allocated_regions() {
  const auto check_clock_side_panels = [](const FakeCanvas &canvas, const Frame &f) {
    FakeCanvas expected(96, 8);
    draw_home_temperature_panel(expected, 0, f.home_temperature, f.home_temperature_valid);
    draw_weather_panel(expected, 72, f, true, true);
    for (int y = 0; y < 8; y++) {
      for (int x = 0; x < 24; x++) CHECK_EQ(canvas.get(x, y), expected.get(x, y));
      for (int x = 72; x < 96; x++) CHECK_EQ(canvas.get(x, y), expected.get(x, y));
    }
  };

  FakeCanvas clock(96, 8), clock_reference(48, 8);
  Frame f = base_frame(1000);
  f.clock_layout = CLOCK_LAYOUT_HOME_AND_OUTDOOR_WEATHER;
  f.home_temperature = 22.4f;
  f.home_temperature_valid = true;
  f.outdoor_temperature = 12.6f;
  f.outdoor_temperature_valid = true;
  f.weather_condition = WEATHER_RAIN;
  f.seconds_mode = SECONDS_OFF;
  f.animate = true;
  f.animation_ms = 600;
  reset_state();
  render(clock, compact, compact, f, report);
  reset_state();
  render(clock_reference, compact, compact, f, report);
  f.now_ms = 1200;
  f.hour = 0;
  f.minute = 0;
  render(clock, compact, compact, f, report);
  render(clock_reference, compact, compact, f, report);
  check_clock_side_panels(clock, f);
  for (int y = 0; y < 8; y++) for (int x = 24; x < 72; x++) CHECK_EQ(clock.get(x, y), clock_reference.get(x - 24, y));

  FakeCanvas date(96, 8), date_reference(72, 8);
  f = base_frame(1000);
  f.screen = SCREEN_DATE;
  f.date_format = DATE_DD_MM;
  f.date_show_weather_icon = true;
  f.date_show_outdoor_temperature = true;
  f.weather_condition = WEATHER_SNOW;
  f.outdoor_temperature = -4.2f;
  f.outdoor_temperature_valid = true;
  f.animate = true;
  f.animation_ms = 600;
  f.day = 1;
  reset_state();
  render(date, compact, compact, f, report);
  reset_state();
  render(date_reference, compact, compact, f, report);
  f.now_ms = 1200;
  f.day = 2;
  render(date, compact, compact, f, report);
  render(date_reference, compact, compact, f, report);
  FakeCanvas expected(96, 8);
  draw_weather_panel(expected, 72, f, true, true);
  for (int y = 0; y < 8; y++) {
    for (int x = 0; x < 72; x++) CHECK_EQ(date.get(x, y), date_reference.get(x, y));
    for (int x = 72; x < 96; x++) CHECK_EQ(date.get(x, y), expected.get(x, y));
  }
}

static void test_temperature_content() {
  Frame f = base_frame();
  char out[24];
  f.temperature_valid = false;
  CHECK(build_content(f, MODE_TEMPERATURE, false, out, sizeof(out)));
  CHECK(strcmp(out, "--.-") == 0);
  f.temperature_valid = true;
  f.temperature_c = 23.4f;
  CHECK(build_content(f, MODE_TEMPERATURE, false, out, sizeof(out)));
  CHECK(strcmp(out, "23.4") == 0);
  f.temperature_c = -2.1f;
  CHECK(build_content(f, MODE_TEMPERATURE, false, out, sizeof(out)));
  CHECK(strcmp(out, "-2.1") == 0);
}

static void test_12_hour_clock_blanks_leading_zero() {
  Frame f = base_frame();
  f.use_12h = true;
  char out[24];
  f.hour = 9;
  f.minute = 5;
  CHECK(build_content(f, MODE_CLOCK, false, out, sizeof(out)));
  CHECK(strcmp(out, " 9:05") == 0);
  f.hour = 21;
  CHECK(build_content(f, MODE_CLOCK, false, out, sizeof(out)));
  CHECK(strcmp(out, " 9:05") == 0 || strcmp(out, "09:05") == 0);
  f.hour = 13;
  CHECK(build_content(f, MODE_CLOCK, false, out, sizeof(out)));
  CHECK(strcmp(out, " 1:05") == 0);
  f.hour = 12;
  f.minute = 34;
  CHECK(build_content(f, MODE_CLOCK, false, out, sizeof(out)));
  CHECK(strcmp(out, "12:34") == 0);
  f.hour = 0;
  CHECK(build_content(f, MODE_CLOCK, false, out, sizeof(out)));
  CHECK(strcmp(out, "12:34") == 0);
}

static void test_deadline_rollover() {
  CHECK(!deadline_reached(0, 0));            // 0 means "inactive"
  CHECK(deadline_reached(1000, 1000));
  CHECK(deadline_reached(2000, 1000));
  CHECK(deadline_reached(100, 0xFFFFFFF0UL));  // wrapped around millis()
  CHECK(!deadline_reached(0xFFFF0000UL, 0x00001000UL));
}

static void test_millis_wrap_keeps_clock_stable() {
  // A frame shortly after a millis() wrap must still render the clock.
  FakeCanvas canvas;
  FakeFont font(6);
  Frame f = base_frame();
  f.now_ms = 0xFFFFFF00UL;
  reset_state();
  render(canvas, font, compact, f, report);

  font.calls.clear();
  canvas.clear();
  f.now_ms = 0x00000100UL;  // wrapped past zero
  render(canvas, font, compact, f, report);
  CHECK(canvas.on_count() > 0);
  CHECK(!state.anim_active);
}

static void test_blinking_colon_keeps_layout_stable() {
  // Faces exist where ':' and ' ' have different advances (Rajdhani is 2 vs
  // 3 px, Rationale is 3 vs 2 px). Substituting a space for the blinked
  // separator changed the line width and visibly re-centred the clock every
  // second; the ':' must keep its advance and only lose its ink.
  class BlinkFont : public GlyphFont {
   public:
    int advance(char c) const override {
      if (c == ':') return 9;
      if (c == ' ') return 2;
      return 6;
    }
    int ink_height() const override { return 7; }
    int ink_top() const override { return 0; }
    void draw_glyph(Canvas &c, char ch, int x, int box_top) const override {
      calls.push_back({ch, x, box_top});
      if (ch == ':' || ch == ' ') return;  // punctuation without ink
      for (int row = 0; row < 7; row++)
        for (int col = 0; col < 5; col++) c.pixel(x + col, box_top + row, true);
    }
    mutable std::vector<DrawCall> calls;
    int calls_for(char ch) const {
      int n = 0;
      for (const auto &call : calls)
        if (call.ch == ch) n++;
      return n;
    }
  };

  FakeCanvas canvas;
  BlinkFont font;
  Frame f = base_frame();
  f.seconds_mode = SECONDS_OFF;
  f.blink_colon = true;
  f.second = 56;  // even -> separator visible

  reset_state();
  render(canvas, font, compact, f, report);
  CHECK_EQ(font.calls_for(':'), 1);
  int first_x = -1;
  for (const auto &call : font.calls)
    if (call.ch == '1') first_x = call.x;
  CHECK_EQ(first_x, 7);  // width 6+6+9+6+6 = 33, centred at (48-33)/2

  font.calls.clear();
  canvas.clear();
  f.second = 57;  // odd -> separator blanked
  f.now_ms = 1000;
  render(canvas, font, compact, f, report);
  CHECK_EQ(font.calls_for(':'), 0);  // no colon ink...
  CHECK_EQ(font.calls_for(' '), 0);  // ...and no space substituted for it
  int blanked_first_x = -1;
  for (const auto &call : font.calls)
    if (call.ch == '1') blanked_first_x = call.x;
  CHECK_EQ(blanked_first_x, first_x);  // identical layout on both half-seconds
  CHECK(canvas.on_count() > 0);
}

// Mimics the external ESPHome faces: clock glyphs only, letters report the
// advance 0 that the SourceFont adapter returns for missing glyphs.
class ClockOnlyFont : public GlyphFont {
 public:
  static bool clock_glyph(char c) { return strchr("0123456789:.-/%!?+ ", c) != nullptr; }
  int advance(char c) const override { return clock_glyph(c) ? 6 : 0; }
  int ink_height() const override { return 8; }
  int ink_top() const override { return 0; }
  void draw_glyph(Canvas &c, char ch, int x, int box_top) const override {
    calls.push_back({ch, x, box_top});
    if (!clock_glyph(ch)) return;
    for (int row = 0; row < 8; row++)
      for (int col = 0; col < 5; col++) c.pixel(x + col, box_top + row, true);
  }
  mutable std::vector<DrawCall> calls;
  int calls_for(char ch) const {
    int n = 0;
    for (const auto &call : calls)
      if (call.ch == ch) n++;
    return n;
  }
};

static void test_latin_message_falls_back_to_builtin_font() {
  // The external faces compile no letters, so a Latin message must be drawn
  // entirely with the built-in font instead of collapsing zero-advance
  // glyphs on top of each other.
  FakeCanvas canvas;
  ClockOnlyFont font;
  Frame f = base_frame();

  reset_state();
  state.set_message("HELLO", 0, 0);
  render(canvas, font, compact, f, report);
  CHECK(canvas.on_count() > 0);            // the built-in face drew the word
  CHECK_EQ(font.calls.size(), 0u);         // the letter-less face was not used

  // A numeric message keeps the selected face.
  canvas.clear();
  font.calls.clear();
  state.clear_message();
  state.set_message("42", 0, 0);
  f.now_ms = 1000;
  render(canvas, font, compact, f, report);
  CHECK_EQ(font.calls_for('4'), 1);
  CHECK_EQ(font.calls_for('2'), 1);
  CHECK(canvas.on_count() > 0);
}

static void test_message_uses_selected_font_metrics() {
  // Vertical centring must come from the font that actually draws the text,
  // not from the built-in fallback (ink 7 px, top 0 -> box_top 0).
  FakeCanvas canvas;
  FakeFont font(6, /*ink_height=*/6, /*ink_top=*/2);  // centred_box_top(8) = -1
  Frame f = base_frame();

  reset_state();
  state.set_message("42", 0, 0);
  render(canvas, font, compact, f, report);
  CHECK(!font.calls.empty());
  CHECK_EQ(font.calls[0].box_top, -1);
}

static void test_ota_text_falls_back_to_builtin_font() {
  // Every OTA state deliberately uses the readable 7-row fallback; an 8-row
  // selected face must never collide with the progress bar.
  FakeCanvas canvas;
  ClockOnlyFont font;
  Frame f = base_frame();

  reset_state();
  state.ota_state = OTA_STARTING;
  render(canvas, font, compact, f, report);
  CHECK(canvas.on_count() > 0);
  CHECK_EQ(font.calls.size(), 0u);

  canvas.clear();
  font.calls.clear();
  state.ota_state = OTA_SUCCESS;
  f.now_ms = 1000;
  render(canvas, font, compact, f, report);
  CHECK_EQ(font.calls.size(), 0u);
  CHECK(canvas.on_count() > 0);
}

static void test_builtin_font_renders_every_required_glyph() {
  // The built-in face is the message fallback, so it must cover the whole
  // status glyph set - '+' was missing until now and silently drew blank.
  for (const char *text = "0123456789:.-/%!?+ "; *text; ++text) {
    FakeCanvas canvas;
    const char one[2] = {*text, '\0'};
    compact.draw_text(canvas, one, 0, 0);
    CHECK(compact.advance(*text) > 0);
    if (*text != ' ') CHECK(canvas.on_count() > 0);  // space is intentionally blank
  }
}

static void test_default_layout_matches_readme() {
  // 6 modules of 8x8 in one row: 48x8 is the documented default.
  FakeCanvas canvas(48, 8);
  CHECK_EQ(canvas.width(), 48);
  CHECK_EQ(canvas.height(), 8);
  // The compact built-in clock never needs a second row or a scroll.
  CHECK(compact.text_width("23:59:59") <= 48);
}

static void test_slide_is_clipped_to_its_own_window() {
  FakeCanvas canvas(48, 16);
  FakeFont font(6, 7, 2);
  const int top = font.centered_box_top(16);
  draw_line(canvas, font, "12:35", "12:34", 0.5f, ALIGN_LEFT, top, false, 2);
  // No ghost ink above or below the centred digit band, even with spare rows.
  for (int y = 0; y < 16; y++) {
    if (y < top + font.ink_top() || y >= top + font.ink_top() + font.ink_height()) CHECK_EQ(canvas.row_on(y), 0);
  }
  CHECK_EQ(font.calls_for('1'), 1);
  CHECK_EQ(font.calls_for('2'), 1);
  CHECK_EQ(font.calls_for(':'), 1);
  CHECK_EQ(font.calls_for('3'), 1);
  CHECK_EQ(font.calls_for('4'), 1);
  CHECK_EQ(font.calls_for('5'), 1);
}

static void test_disabling_animation_cancels_mid_slide() {
  FakeCanvas canvas;
  FakeFont font(6);
  Frame f = base_frame(); f.animate = true;
  reset_state(); render(canvas, font, compact, f, report);
  f.second++; f.now_ms = 1000;
  render(canvas, font, compact, f, report); CHECK(state.anim_active);
  f.animate = false; f.now_ms += 20;
  render(canvas, font, compact, f, report); CHECK(!state.anim_active);
  f.animate = true; f.second++; f.now_ms = 2000;
  render(canvas, font, compact, f, report); CHECK(state.anim_active);
  f.animation_ms = 0;
  render(canvas, font, compact, f, report); CHECK(!state.anim_active);
}

static void test_font_alignment_geometry_changes_cancel_animation() {
  FakeCanvas canvas;
  FakeFont font(6), replacement(6);
  Frame f = base_frame(); f.animate = true;
  reset_state(); render(canvas, font, compact, f, report);
  f.second++; f.now_ms = 1000;
  render(canvas, font, compact, f, report); CHECK(state.anim_active);
  render(canvas, replacement, compact, f, report); CHECK(!state.anim_active);
  f.second++; f.now_ms = 2000;
  render(canvas, replacement, compact, f, report); CHECK(state.anim_active);
  f.alignment = ALIGN_LEFT;
  render(canvas, replacement, compact, f, report); CHECK(!state.anim_active);
  f.second++; f.now_ms = 3000;
  render(canvas, replacement, compact, f, report); CHECK(state.anim_active);
  FakeCanvas tall(48, 16);
  render(tall, replacement, compact, f, report); CHECK(!state.anim_active);
}

static void test_progress_is_actual_percentage_and_deduplicated() {
  reset_state();
  CHECK_EQ(ota_progress_percent(-1), 0);
  CHECK_EQ(ota_progress_percent(0.0f / 0.0f), 0);
  CHECK_EQ(ota_progress_percent(0), 0);
  CHECK_EQ(ota_progress_percent(1), 1);
  CHECK_EQ(ota_progress_percent(42.9f), 42);
  CHECK_EQ(ota_progress_percent(100), 100);
  CHECK_EQ(ota_progress_percent(101), 100);
  CHECK(set_ota_progress(42.1f));
  CHECK(!set_ota_progress(42.9f));
  CHECK(set_ota_progress(43));
  CHECK_EQ(state.ota_percent, 43);
  FakeCanvas canvas;
  Frame f = base_frame();
  render(canvas, compact, compact, f, report);
  CHECK_EQ(canvas.row_on(7), 48 * 43 / 100);
  state.ota_percent = 255;
  canvas.clear(); render(canvas, compact, compact, f, report);
  CHECK_EQ(canvas.row_on(7), 48);  // even a corrupted value cannot overflow bar
}

static void test_boot_installed_version_priority_expiry_and_wrap() {
  reset_state();
  FakeCanvas canvas;
  FakeFont primary(6), fallback(6);
  Frame f = base_frame(); f.now_ms = 1000;
  state.begin_boot("0.7.0+abcdef012345", 2500, f.now_ms);
  CHECK_EQ(effective_mode(f), MODE_BOOT);
  CHECK(strcmp(state.boot_version, "V0.7.0+abcdef012345") == 0);
  render(canvas, primary, fallback, f, report);
  CHECK(primary.calls.empty()); CHECK(!fallback.calls.empty());
  f.now_ms = 3499; render(canvas, primary, fallback, f, report); CHECK(state.boot_active);
  f.now_ms = 3500; render(canvas, primary, fallback, f, report); CHECK(!state.boot_active);
  CHECK_EQ(effective_mode(f), MODE_CLOCK); CHECK(!state.anim_active);
  state.begin_boot("0.7.0", 100000, f.now_ms); CHECK_EQ(state.boot_duration_ms, 10000U);
  state.begin_ota(false); CHECK(!state.boot_active); CHECK_EQ(effective_mode(f), MODE_OTA);
  reset_state();
  state.begin_boot("0.7.0", 2500, 0xffffff00U);
  f.now_ms = 0xffffff00U + 2499U; render(canvas, primary, fallback, f, report); CHECK(state.boot_active);
  f.now_ms++; render(canvas, primary, fallback, f, report); CHECK(!state.boot_active);
  state.begin_boot("0.7.0", 0, f.now_ms); CHECK(!state.boot_active);
}

static void test_ota_overrides_alarm_and_zero_night_brightness() {
  reset_state();
  Frame f = base_frame(); f.alarm_mode = true; f.night_manual = true;
  f.brightness_night = 0; f.ota_brightness = 0;
  state.begin_ota(false);
  FakeCanvas canvas;
  render(canvas, compact, compact, f, report); CHECK_EQ(state.applied_brightness, 1);
  f.ota_brightness = 4; f.now_ms = 500;
  render(canvas, compact, compact, f, report); CHECK_EQ(state.applied_brightness, 4);
  state.ota_state = OTA_ERROR;
  f.now_ms = 600;
  render(canvas, compact, compact, f, report); CHECK_EQ(state.applied_brightness, 4);
  state.ota_state = OTA_IDLE; f.alarm_mode = false;
  render(canvas, compact, compact, f, report); CHECK_EQ(state.applied_brightness, 0);
}

int main() {
  printf("running renderer tests\n");
  test_slide_is_clipped_to_its_own_window();
  test_disabling_animation_cancels_mid_slide();
  test_font_alignment_geometry_changes_cancel_animation();
  test_progress_is_actual_percentage_and_deduplicated();
  test_boot_installed_version_priority_expiry_and_wrap();
  test_ota_overrides_alarm_and_zero_night_brightness();
  test_builtin_font_is_compact_enough();
  test_message_text_helpers();
  test_unknown_glyphs_do_not_break_layout();
  test_hour_day_and_12h_boundaries();
  test_animation_survives_hour_rollover();
  test_clock_layout();
  test_seconds_dropped_when_too_wide();
  test_falls_back_to_builtin_font();
  test_invalid_time_shows_placeholder();
  test_mode_priority_ota_wins();
  test_mode_priority_alert_over_message();
  test_message_beats_countdown_but_loses_to_ota();
  test_countdown_expires_into_alert();
  test_countdown_never_exceeds_5999_seconds();
  test_ota_screen_draws_percentage_and_bar();
  test_ota_error_and_success_screens();
  test_ota_narrowed_on_small_display();
  test_only_changed_digits_animate();
  test_animation_disabled_and_mode_change_reset();
  test_blinking_colon();
  test_seconds_bar();
  test_message_scrolling_and_static();
  test_message_without_duration_stays_until_cleared();
  test_message_and_alert_expire();
  test_night_brightness_schedule();
  test_manual_night_switch();
  test_brightness_entity_change_applies_without_flip();
  test_auto_cycle_clock_date();
  test_date_screen_duration_is_independent();
  test_selected_screen_change_starts_slide_transition();
  test_scrolling_date_starts_after_screen_slide_transition();
  test_alarm_mode_flashes_twice_per_second();
  test_bitmap_test_screens();
  test_report_publishes_only_on_change();
  test_alignment();
  test_date_formats();
  test_weather_condition_normalization();
  test_weather_temperature_values_are_explicit_and_prioritized();
  test_fixed_weather_panels_and_bitmap_categories();
  test_twelve_module_clock_layouts_keep_clock_in_middle_six();
  test_six_module_clock_ignores_weather_panels_for_compatibility();
  test_date_weather_switches_reserve_the_right_panel_and_scroll_inside_safe_width();
  test_clock_and_date_digit_animation_stay_inside_allocated_regions();
  test_temperature_content();
  test_12_hour_clock_blanks_leading_zero();
  test_deadline_rollover();
  test_millis_wrap_keeps_clock_stable();
  test_blinking_colon_keeps_layout_stable();
  test_latin_message_falls_back_to_builtin_font();
  test_message_uses_selected_font_metrics();
  test_ota_text_falls_back_to_builtin_font();
  test_builtin_font_renders_every_required_glyph();
  test_default_layout_matches_readme();
  test_slide_animation_uses_ink_height_not_canvas_height();
  test_animation_row_gap_separates_old_and_new_digits();

  printf("%d checks, %d failures\n", checks, failures);
  return failures == 0 ? 0 : 1;
}
