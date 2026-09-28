// Pure C++17 renderer for the MAX7219 matrix clock.
//
// This header intentionally depends on nothing but the C++ standard library so
// that it can be unit tested on a workstation (see tests/test_renderer.cpp)
// while the ESPHome build only supplies two thin adapters
// (max7219_clock_esphome.h) for the display and the fonts.
//
// Layout, screen priority, animation, scrolling, countdown and OTA screens all
// live here; the YAML packages only map Home Assistant entities and API
// actions onto `Frame`, `Runtime` and `Report`.
//
// The default display is six 8x8 MAX7219 modules in one row (48x8 pixels).
// Every string that the firmware can draw is measured against the display
// width at runtime and degrades in this order:
//   1. the selected font, full "HH:MM:SS"
//   2. the selected font, "HH:MM" (seconds moved to the bottom-row bar)
//   3. the built-in compact 5x7 bitmap font, which always fits 48x8
//   4. for free text: scrolling instead of static, so text is never clipped
//      away silently

#pragma once

#include <stdint.h>
#include <stdio.h>
#include <string.h>

#include <algorithm>

namespace max7219_clock {

// --------------------------------------------------------------------------
// Modes, options and state enums (kept as plain ints so YAML comparisons stay
// simple: the adapter maps option strings to these values).
// --------------------------------------------------------------------------
enum Mode : uint8_t {
  MODE_CLOCK = 0,
  MODE_DATE,
  MODE_MESSAGE,
  MODE_COUNTDOWN,
  MODE_OTA,
  MODE_GRID_TEST,
  MODE_PIXEL_TEST,
};

enum Screen : uint8_t {
  SCREEN_CLOCK = 0,
  SCREEN_DATE,
  SCREEN_GRID_TEST,
  SCREEN_PIXEL_TEST,
};

enum OtaState : uint8_t {
  OTA_IDLE = 0,
  OTA_STARTING,
  OTA_UPLOADING,
  OTA_SUCCESS,
  OTA_ERROR,
};

enum Alignment : uint8_t {
  ALIGN_LEFT = 0,
  ALIGN_CENTER,
  ALIGN_RIGHT,
};

enum SecondsMode : uint8_t {
  SECONDS_OFF = 0,
  SECONDS_DIGITS,
  SECONDS_BAR,
};

enum DateFormat : uint8_t {
  DATE_DD_MM = 0,  // 31.12
  DATE_MM_DD,      // 12/31
  DATE_DD_MM_SLASH,// 31/12
};

// --------------------------------------------------------------------------
// Drawing interface implemented by the ESPHome display adapter.
// --------------------------------------------------------------------------
class Canvas {
 public:
  virtual ~Canvas() {}
  virtual void pixel(int x, int y, bool on) = 0;
  virtual int width() const = 0;
  virtual int height() const = 0;

  void fill_rect(int x, int y, int w, int h, bool on) {
    for (int yy = y; yy < y + h; yy++)
      for (int xx = x; xx < x + w; xx++) this->pixel(xx, yy, on);
  }
  void hline(int x, int y, int w, bool on = true) { fill_rect(x, y, w, 1, on); }
  void rect(int x, int y, int w, int h, bool on = true) {
    hline(x, y, w, on);
    hline(x, y + h - 1, w, on);
    fill_rect(x, y, 1, h, on);
    fill_rect(x + w - 1, y, 1, h, on);
  }
};

// --------------------------------------------------------------------------
// Font interface: one glyph cell at a time so that the renderer owns layout,
// alignment and the per-digit slide-up animation.
// --------------------------------------------------------------------------
class GlyphFont {
 public:
  virtual ~GlyphFont() {}
  // Horizontal step for one character, in pixels.
  virtual int advance(char c) const = 0;
  // Ink height and the ink offset from the text box top, measured on a digit.
  // The renderer uses both to centre the ink inside the display.
  virtual int ink_height() const = 0;
  virtual int ink_top() const = 0;
  // Draw a single character with its text box top at `box_top`.
  virtual void draw_glyph(Canvas &c, char ch, int x, int box_top) const = 0;

  int text_width(const char *s) const {
    int w = 0;
    if (s != nullptr)
      for (const char *p = s; *p != '\0'; p++) w += this->advance(*p);
    return w;
  }
  // Text box top that puts the digit ink in the vertical middle of the display.
  int centered_box_top(int display_height) const {
    return (display_height - this->ink_height()) / 2 - this->ink_top();
  }
  void draw_text(Canvas &c, const char *s, int x, int box_top) const {
    if (s == nullptr) return;
    int cursor = x;
    for (const char *p = s; *p != '\0'; p++) {
      this->draw_glyph(c, *p, cursor, box_top);
      cursor += this->advance(*p);
    }
  }
};

// --------------------------------------------------------------------------
// Built-in compact 5x7 bitmap font. Always available, needs no download and
// always fits "HH:MM:SS" (42 of 48 pixels on the default display), so the
// clock keeps working when a web font cannot be downloaded at build time or
// when a selected font is too wide for the configured matrix.
// --------------------------------------------------------------------------
namespace builtin {

// 7 rows, 5 columns, bit 4 = leftmost pixel.
inline const uint8_t *glyph(char c) {
  static const uint8_t DIGITS[10][7] = {
      {0b01110, 0b10001, 0b10011, 0b10101, 0b11001, 0b10001, 0b01110},  // 0
      {0b00100, 0b01100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110},  // 1
      {0b01110, 0b10001, 0b00001, 0b00010, 0b00100, 0b01000, 0b11111},  // 2
      {0b11110, 0b00001, 0b00001, 0b01110, 0b00001, 0b00001, 0b11110},  // 3
      {0b00010, 0b00110, 0b01010, 0b10010, 0b11111, 0b00010, 0b00010},  // 4
      {0b11111, 0b10000, 0b10000, 0b11110, 0b00001, 0b00001, 0b11110},  // 5
      {0b00110, 0b01000, 0b10000, 0b11110, 0b10001, 0b10001, 0b01110},  // 6
      {0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b01000, 0b01000},  // 7
      {0b01110, 0b10001, 0b10001, 0b01110, 0b10001, 0b10001, 0b01110},  // 8
      {0b01110, 0b10001, 0b10001, 0b01111, 0b00001, 0b00010, 0b11100},  // 9
  };
  static const uint8_t LETTERS[26][7] = {
      {0b01110, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001},  // A
      {0b11110, 0b10001, 0b10001, 0b11110, 0b10001, 0b10001, 0b11110},  // B
      {0b01110, 0b10001, 0b10000, 0b10000, 0b10000, 0b10001, 0b01110},  // C
      {0b11100, 0b10010, 0b10001, 0b10001, 0b10001, 0b10010, 0b11100},  // D
      {0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b11111},  // E
      {0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b10000},  // F
      {0b01110, 0b10001, 0b10000, 0b10111, 0b10001, 0b10001, 0b01110},  // G
      {0b10001, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001},  // H
      {0b01110, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110},  // I
      {0b00111, 0b00010, 0b00010, 0b00010, 0b00010, 0b10010, 0b01100},  // J
      {0b10001, 0b10010, 0b10100, 0b11000, 0b10100, 0b10010, 0b10001},  // K
      {0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b11111},  // L
      {0b10001, 0b11011, 0b10101, 0b10101, 0b10001, 0b10001, 0b10001},  // M
      {0b10001, 0b10001, 0b11001, 0b10101, 0b10011, 0b10001, 0b10001},  // N
      {0b01110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110},  // O
      {0b11110, 0b10001, 0b10001, 0b11110, 0b10000, 0b10000, 0b10000},  // P
      {0b01110, 0b10001, 0b10001, 0b10001, 0b10101, 0b10010, 0b01101},  // Q
      {0b11110, 0b10001, 0b10001, 0b11110, 0b10100, 0b10010, 0b10001},  // R
      {0b01111, 0b10000, 0b10000, 0b01110, 0b00001, 0b00001, 0b11110},  // S
      {0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100},  // T
      {0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110},  // U
      {0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01010, 0b00100},  // V
      {0b10001, 0b10001, 0b10001, 0b10101, 0b10101, 0b11011, 0b10001},  // W
      {0b10001, 0b10001, 0b01010, 0b00100, 0b01010, 0b10001, 0b10001},  // X
      {0b10001, 0b10001, 0b01010, 0b00100, 0b00100, 0b00100, 0b00100},  // Y
      {0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b10000, 0b11111},  // Z
  };
  static const uint8_t SPACE[7] = {0, 0, 0, 0, 0, 0, 0};
  static const uint8_t COLON[7] = {0b00000, 0b01100, 0b01100, 0b00000, 0b01100, 0b01100, 0b00000};
  static const uint8_t DOT[7] = {0b00000, 0b00000, 0b00000, 0b00000, 0b00000, 0b01100, 0b01100};
  static const uint8_t COMMA[7] = {0b00000, 0b00000, 0b00000, 0b00000, 0b00000, 0b00100, 0b01000};
  static const uint8_t DASH[7] = {0b00000, 0b00000, 0b00000, 0b01110, 0b00000, 0b00000, 0b00000};
  static const uint8_t SLASH[7] = {0b00001, 0b00010, 0b00100, 0b01000, 0b10000, 0b00000, 0b00000};
  static const uint8_t PERCENT[7] = {0b01101, 0b01101, 0b00010, 0b00100, 0b01000, 0b10110, 0b10110};
  static const uint8_t EXCLAMATION[7] = {0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00000, 0b00100};
  static const uint8_t QUESTION[7] = {0b01110, 0b10001, 0b00001, 0b00010, 0b00100, 0b00000, 0b00100};

  if (c >= '0' && c <= '9') return DIGITS[c - '0'];
  if (c >= 'A' && c <= 'Z') return LETTERS[c - 'A'];
  switch (c) {
    case ' ':
      return SPACE;
    case ':':
      return COLON;
    case '.':
      return DOT;
    case ',':
      return COMMA;
    case '-':
    case '_':
      return DASH;
    case '/':
      return SLASH;
    case '%':
      return PERCENT;
    case '!':
      return EXCLAMATION;
    case '?':
      return QUESTION;
    default:
      return SPACE;
  }
}

inline int advance(char c) {
  switch (c) {
    case ':':
    case '.':
    case ',':
    case '!':
    case ' ':
      return 3;
    default:
      return 6;
  }
}

}  // namespace builtin

class BuiltinFont : public GlyphFont {
 public:
  int advance(char c) const override { return builtin::advance(c); }
  int ink_height() const override { return 7; }
  int ink_top() const override { return 0; }
  void draw_glyph(Canvas &c, char ch, int x, int box_top) const override {
    const uint8_t *rows = builtin::glyph(ch);
    for (int row = 0; row < 7; row++)
      for (int col = 0; col < 5; col++)
        if (rows[row] & (1 << (4 - col))) c.pixel(x + col, box_top + row, true);
  }
};

// --------------------------------------------------------------------------
// Frame: everything the renderer needs for one redraw, filled from Home
// Assistant entities and the clock source. No pointers are owned.
// --------------------------------------------------------------------------
struct Frame {
  uint32_t now_ms = 0;

  // Clock source
  bool time_valid = false;
  int hour = 0;
  int minute = 0;
  int second = 0;
  int day = 1;
  int month = 1;

  // Display preferences (entity state)
  int screen = SCREEN_CLOCK;
  int alignment = ALIGN_CENTER;
  int seconds_mode = SECONDS_DIGITS;
  int date_format = DATE_DD_MM;
  bool use_12h = false;
  bool blink_colon = true;
  bool animate = true;
  uint32_t animation_ms = 250;
  bool message_scroll = true;
  uint32_t scroll_ms_per_px = 60;

  // Night brightness scheduling
  bool night_manual = false;
  bool night_schedule = false;
  int night_start_hour = 22;
  int night_end_hour = 7;
  float brightness_day = 3.0f;
  float brightness_night = 1.0f;

  // Automatic screen cycling
  bool auto_cycle = false;
  uint32_t cycle_interval_s = 10;
};

// --------------------------------------------------------------------------
// Runtime: everything that must survive between redraws but must not touch
// flash. Held in one inline instance (see `state` below) so the YAML actions
// can set message, alert and countdown state directly.
// --------------------------------------------------------------------------
struct Runtime {
  // Temporary screens
  char message_text[48] = {0};  // scrolling message from Home Assistant
  bool message_active = false;
  uint32_t message_deadline_ms = 0;  // 0 while no expiry is wanted
  uint32_t message_started_ms = 0;
  char alert_text[24] = {0};  // short static text (status, countdown done)
  bool alert_active = false;
  uint32_t alert_deadline_ms = 0;
  uint32_t alert_started_ms = 0;

  uint32_t countdown_deadline_ms = 0;  // 0 while inactive
  uint32_t countdown_total_ms = 0;
  bool countdown_finished = false;

  // OTA upload state (transient, never restored)
  uint8_t ota_state = OTA_IDLE;
  uint8_t ota_percent = 0;
  uint8_t ota_error = 0;
  bool display_power_before_ota = true;

  // Slide-up animation
  char anim_prev[24] = {0};
  int anim_prev_mode = -1;
  uint32_t anim_started_ms = 0;
  bool anim_active = false;

  // Message/alert scrolling identity
  uint32_t scroll_hash = 0;
  uint32_t scroll_started_ms = 0;

  // Housekeeping bookkeeping
  uint32_t last_tick_ms = 0;
  bool night_active = false;
  uint32_t cycle_last_ms = 0;

  // Last values published to Home Assistant (publish on change only)
  int reported_mode = -1;
  int reported_ota_state = -1;
  int reported_remaining_s = -2;
  int reported_percent = -1;

  void set_message(const char *text, uint32_t duration_ms, uint32_t now_ms) {
    if (text == nullptr) text = "";
    snprintf(this->message_text, sizeof(this->message_text), "%.47s", text);
    this->message_active = true;
    this->message_started_ms = now_ms;
    this->message_deadline_ms = duration_ms == 0 ? 0 : now_ms + duration_ms;
    // A new message restarts the scroll position.
    this->scroll_hash = 0;
  }
  void clear_message() {
    this->message_text[0] = '\0';
    this->message_active = false;
    this->message_deadline_ms = 0;
  }
  void set_alert(const char *text, uint32_t duration_ms, uint32_t now_ms) {
    if (text == nullptr) text = "";
    snprintf(this->alert_text, sizeof(this->alert_text), "%.23s", text);
    this->alert_active = true;
    this->alert_started_ms = now_ms;
    this->alert_deadline_ms = duration_ms == 0 ? 0 : now_ms + duration_ms;
    this->scroll_hash = 0;
  }
  void clear_alert() {
    this->alert_text[0] = '\0';
    this->alert_active = false;
    this->alert_deadline_ms = 0;
  }
  void start_countdown(uint32_t seconds, uint32_t now_ms) {
    if (seconds < 1) seconds = 1;
    if (seconds > 3599) seconds = 3599;
    this->countdown_total_ms = seconds * 1000UL;
    this->countdown_deadline_ms = now_ms + this->countdown_total_ms;
    this->countdown_finished = false;
  }
  void cancel_countdown() {
    this->countdown_deadline_ms = 0;
    this->countdown_total_ms = 0;
    this->countdown_finished = false;
  }
};

// Report: what changed during this redraw and therefore what the YAML side has
// to publish to Home Assistant. Publishing only on change keeps API traffic low.
struct Report {
  bool mode_changed = false;
  uint8_t mode = MODE_CLOCK;
  const char *mode_name = "Clock";

  bool remaining_changed = false;
  int remaining_s = -1;  // -1: no countdown

  bool ota_state_changed = false;
  uint8_t ota_state = OTA_IDLE;
  const char *ota_state_name = "Idle";

  bool percent_changed = false;
  uint8_t percent = 0;

  bool countdown_finished = false;

  bool brightness_changed = false;
  float brightness = 3.0f;

  bool screen_changed = false;  // automatic clock/date cycling
  uint8_t screen = SCREEN_CLOCK;
};

// One inline instance per firmware; the API actions and buttons write here.
inline Runtime state;

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------
inline const char *mode_name(uint8_t mode) {
  switch (mode) {
    case MODE_CLOCK:
      return "Clock";
    case MODE_DATE:
      return "Date";
    case MODE_MESSAGE:
      return "Message";
    case MODE_COUNTDOWN:
      return "Countdown";
    case MODE_OTA:
      return "OTA";
    case MODE_GRID_TEST:
      return "Module grid test";
    case MODE_PIXEL_TEST:
      return "Pixel checkerboard";
    default:
      return "Unknown";
  }
}

inline const char *screen_name(uint8_t screen) {
  switch (screen) {
    case SCREEN_CLOCK:
      return "Clock";
    case SCREEN_DATE:
      return "Date";
    case SCREEN_GRID_TEST:
      return "Module grid test";
    case SCREEN_PIXEL_TEST:
      return "Pixel checkerboard";
    default:
      return "Clock";
  }
}

inline const char *ota_state_name(uint8_t ota_state) {
  switch (ota_state) {
    case OTA_IDLE:
      return "Idle";
    case OTA_STARTING:
      return "Starting";
    case OTA_UPLOADING:
      return "Uploading";
    case OTA_SUCCESS:
      return "Success";
    case OTA_ERROR:
      return "Error";
    default:
      return "Idle";
  }
}

// Rollover-safe "deadline reached?" test for millis() based deadlines.
inline bool deadline_reached(uint32_t now_ms, uint32_t deadline_ms) {
  return deadline_ms != 0 && (int32_t)(now_ms - deadline_ms) >= 0;
}

inline bool is_digit(char c) { return c >= '0' && c <= '9'; }

// A temporary screen is visible while it is armed and either has no deadline
// (duration 0 = until cleared) or has not reached it yet.
inline bool temporary_screen_active(bool active, uint32_t now_ms, uint32_t deadline_ms) {
  return active && (deadline_ms == 0 || !deadline_reached(now_ms, deadline_ms));
}

// Upper-case ASCII in place. The compiled glyph sets only carry upper-case
// letters, so messages are normalised once when they are set instead of
// depending on <cctype> inside a YAML lambda.
inline void upper_ascii(char *text) {
  if (text == nullptr) return;
  for (char *p = text; *p != '\0'; p++) {
    if (*p >= 'a' && *p <= 'z') *p = (char) (*p - 'a' + 'A');
  }
}

// NaN test without <cmath>: the template sensor publishes NAN when no
// countdown is running.
inline bool is_nan(float value) { return value != value; }

inline uint32_t hash_text(const char *text) {
  uint32_t hash = 2166136261UL;
  if (text != nullptr)
    for (const char *p = text; *p != '\0'; p++) {
      hash ^= (uint8_t) *p;
      hash *= 16777619UL;
    }
  return hash;
}

// --------------------------------------------------------------------------
// Screen content
// --------------------------------------------------------------------------
// Format the clock/date/countdown content into `out` (at least 24 bytes).
// Returns false when the mode does not have a fixed-width text content.
inline bool build_content(const Frame &f, uint8_t mode, bool with_seconds, char *out, size_t out_size) {
  switch (mode) {
    case MODE_CLOCK: {
      int hour = f.hour;
      bool blank_leading = false;
      if (f.use_12h) {
        hour = hour % 12;
        if (hour == 0) hour = 12;
        blank_leading = hour < 10;
      }
      if (!f.time_valid) return false;
      if (with_seconds) {
        if (blank_leading)
          snprintf(out, out_size, " %d:%02d:%02d", hour, f.minute, f.second);
        else
          snprintf(out, out_size, "%02d:%02d:%02d", hour, f.minute, f.second);
      } else {
        if (blank_leading)
          snprintf(out, out_size, " %d:%02d", hour, f.minute);
        else
          snprintf(out, out_size, "%02d:%02d", hour, f.minute);
      }
      return true;
    }
    case MODE_DATE:
      switch (f.date_format) {
        case DATE_MM_DD:
          snprintf(out, out_size, "%02d/%02d", f.month, f.day);
          break;
        case DATE_DD_MM_SLASH:
          snprintf(out, out_size, "%02d/%02d", f.day, f.month);
          break;
        default:
          snprintf(out, out_size, "%02d.%02d", f.day, f.month);
          break;
      }
      return true;
    case MODE_COUNTDOWN: {
      uint32_t remaining = 0;
      if (state.countdown_deadline_ms != 0 && (int32_t)(state.countdown_deadline_ms - f.now_ms) > 0)
        remaining = (state.countdown_deadline_ms - f.now_ms) / 1000UL;
      snprintf(out, out_size, "%02u:%02u", (unsigned) (remaining / 60UL), (unsigned) (remaining % 60UL));
      return true;
    }
    default:
      return false;
  }
}

// --------------------------------------------------------------------------
// Renderer
// --------------------------------------------------------------------------
inline void draw_bitmap_test(Canvas &c, uint8_t mode) {
  const int width = c.width();
  const int height = c.height();
  if (mode == MODE_PIXEL_TEST) {
    for (int y = 0; y < height; y++)
      for (int x = 0; x < width; x++)
        if (((x + y) % 2) == 0) c.pixel(x, y, true);
    return;
  }
  // Module grid: one box per 8x8 module, clipped to the display.
  for (int y = 0; y + 8 <= height; y += 8) {
    for (int x = 0; x + 8 <= width; x += 8) {
      c.rect(x, y, 8, 8);
      c.pixel(x + 2, y + 2, true);
    }
  }
  if (height >= 8) {
    // Remaining pixels of a partial module row/column.
    int last_x = (width / 8) * 8;
    if (last_x < width) c.fill_rect(last_x, 0, width - last_x, height > 1 ? 1 : 1, true);
    int last_y = (height / 8) * 8;
    if (last_y < height) c.fill_rect(0, last_y, width, height - last_y, true);
  }
}

// Draw one text line. `animate_from` (may be nullptr) holds the previous
// content of the same length; only changed digits are animated.
inline void draw_line(Canvas &c, const GlyphFont &font, const char *content, const char *animate_from, float progress,
                      int alignment, int box_top) {
  const int width = c.width();
  const int len = content == nullptr ? 0 : (int) strlen(content);
  int text_width = font.text_width(content);

  int start_x = 0;
  if (alignment == ALIGN_CENTER)
    start_x = (width - text_width) / 2;
  else if (alignment == ALIGN_RIGHT)
    start_x = width - text_width;
  if (start_x < 0) start_x = 0;

  const bool animate = animate_from != nullptr && progress < 1.0f && (int) strlen(animate_from) == len;
  const int slide = c.height();

  int cursor = start_x;
  for (int i = 0; i < len; i++) {
    const int step = font.advance(content[i]);
    const bool changed = animate && is_digit(content[i]) && is_digit(animate_from[i]) &&
                         content[i] != animate_from[i];
    if (cursor + step > 0 && cursor < width) {
      if (changed) {
        // Old digit slides up, new digit enters from below.
        const int offset = (int) (progress * slide);
        font.draw_glyph(c, animate_from[i], cursor, box_top - offset);
        font.draw_glyph(c, content[i], cursor, box_top + slide - offset);
      } else {
        font.draw_glyph(c, content[i], cursor, box_top);
      }
    }
    cursor += step;
  }

  // Seconds progress bar (bottom row), drawn after the digits so it wins.
  return;
}

inline void draw_seconds_bar(Canvas &c, int second) {
  const int width = c.width();
  int lit = (int) ((int32_t) width * second / 60);
  if (lit > 0) c.hline(0, c.height() - 1, lit, true);
}

// Scrolling / static free text (messages, alerts).
inline void draw_free_text(Canvas &c, const GlyphFont &font, const char *text, uint32_t elapsed_ms, bool scroll,
                           uint32_t ms_per_px, int box_top) {
  const int width = c.width();
  const int text_width = font.text_width(text);
  if (text_width <= width) {
    draw_line(c, font, text, nullptr, 1.0f, ALIGN_CENTER, box_top);
    return;
  }
  if (!scroll) {
    // Static mode: draw what fits, left aligned, never out of bounds.
    draw_line(c, font, text, nullptr, 1.0f, ALIGN_LEFT, box_top);
    return;
  }
  if (ms_per_px < 1) ms_per_px = 1;
  // Marquee loop: the text starts left aligned (visible immediately), scrolls
  // out to the left, comes back in from the right and repeats. The wrap from
  // "fully off the left edge" to "fully off the right edge" is invisible.
  const uint32_t loop_width = (uint32_t) (text_width + width);
  const uint32_t offset = (elapsed_ms / ms_per_px) % loop_width;
  const int origin_x = offset < (uint32_t) text_width ? -(int) offset : width - (int) (offset - (uint32_t) text_width);
  int cursor = origin_x;
  for (const char *p = text; *p != '\0'; p++) {
    const int step = font.advance(*p);
    if (cursor + step > 0 && cursor < width) font.draw_glyph(c, *p, cursor, box_top);
    cursor += step;
  }
}

// OTA screen: state text, clamped percentage and a bottom-row progress bar.
inline void draw_ota(Canvas &c, const GlyphFont &font, uint8_t ota_state, uint8_t percent, uint8_t error,
                     int box_top) {
  char content[24];
  const int height = c.height();
  bool show_bar = false;
  switch (ota_state) {
    case OTA_STARTING:
      snprintf(content, sizeof(content), "OTA");
      break;
    case OTA_UPLOADING:
      snprintf(content, sizeof(content), "OTA %u%%", (unsigned) percent);
      show_bar = true;
      break;
    case OTA_SUCCESS:
      snprintf(content, sizeof(content), "100%%");
      break;
    case OTA_ERROR:
      snprintf(content, sizeof(content), "ERROR %u", (unsigned) error);
      break;
    default:
      content[0] = '\0';
      break;
  }
  if (content[0] == '\0') return;

  // The progress bar takes the bottom row, so shift the text up by one row
  // when it is shown and keep it inside the display.
  int text_top = box_top;
  if (show_bar && height > 7) text_top = box_top > 0 ? box_top - 1 : 0;

  int available = c.width();
  if (font.text_width(content) > available) {
    // Drop the percentage/error detail before clipping.
    if (ota_state == OTA_UPLOADING)
      snprintf(content, sizeof(content), "OTA");
    else if (ota_state == OTA_ERROR)
      snprintf(content, sizeof(content), "ERROR");
  }
  draw_line(c, font, content, nullptr, 1.0f, ALIGN_CENTER, text_top);

  if (show_bar) {
    const int lit = (int) ((int32_t) c.width() * (percent > 100 ? 100 : percent) / 100);
    if (lit > 0) c.hline(0, height - 1, lit, true);
  }
}

// Determine the effective mode from the priority chain:
// OTA > alert > message > countdown > selected screen.
inline uint8_t effective_mode(const Frame &f) {
  if (state.ota_state != OTA_IDLE) return MODE_OTA;
  if (temporary_screen_active(state.alert_active, f.now_ms, state.alert_deadline_ms)) return MODE_MESSAGE;
  if (temporary_screen_active(state.message_active, f.now_ms, state.message_deadline_ms)) return MODE_MESSAGE;
  if (state.countdown_deadline_ms != 0 && !deadline_reached(f.now_ms, state.countdown_deadline_ms))
    return MODE_COUNTDOWN;
  if (state.countdown_deadline_ms != 0 && !state.countdown_finished) return MODE_COUNTDOWN;  // finishing frame
  switch (f.screen) {
    case SCREEN_DATE:
      return MODE_DATE;
    case SCREEN_GRID_TEST:
      return MODE_GRID_TEST;
    case SCREEN_PIXEL_TEST:
      return MODE_PIXEL_TEST;
    default:
      return MODE_CLOCK;
  }
}

// Housekeeping that only needs to run about once per second: countdown
// completion, night brightness and automatic clock/date cycling.
inline void housekeeping(const Frame &f, Report &report) {
  if (state.last_tick_ms != 0 && (uint32_t)(f.now_ms - state.last_tick_ms) < 1000UL) return;
  state.last_tick_ms = f.now_ms == 0 ? 1 : f.now_ms;

  // Expired temporary screens stop being visible (and free the cycle timer).
  if (state.message_active && state.message_deadline_ms != 0 &&
      deadline_reached(f.now_ms, state.message_deadline_ms)) {
    state.message_active = false;
    state.clear_message();
  }
  if (state.alert_active && state.alert_deadline_ms != 0 && deadline_reached(f.now_ms, state.alert_deadline_ms)) {
    state.clear_alert();
  }

  // Countdown finished: replace it with a short completion alert.
  if (state.countdown_deadline_ms != 0 && deadline_reached(f.now_ms, state.countdown_deadline_ms)) {
    state.countdown_deadline_ms = 0;
    state.countdown_total_ms = 0;
    if (!state.countdown_finished) {
      state.countdown_finished = true;
      report.countdown_finished = true;
      state.set_alert("DONE", 5000UL, f.now_ms);
    }
  }

  // Night brightness: manual switch, or schedule window.
  bool in_window = false;
  if (f.night_schedule) {
    const int hour = f.time_valid ? f.hour : -1;
    if (hour >= 0) {
      if (f.night_start_hour == f.night_end_hour)
        in_window = true;
      else if (f.night_start_hour < f.night_end_hour)
        in_window = hour >= f.night_start_hour && hour < f.night_end_hour;
      else
        in_window = hour >= f.night_start_hour || hour < f.night_end_hour;
    }
  }
  const bool night = f.night_manual || in_window;
  if (night != state.night_active) {
    state.night_active = night;
    report.brightness_changed = true;
    report.brightness = night ? f.brightness_night : f.brightness_day;
  }

  // Automatic clock/date cycling only while a normal screen is selected and no
  // temporary screen (message, countdown, OTA) is active.
  if (f.auto_cycle && !state.alert_active && !state.message_active &&
      state.countdown_deadline_ms == 0 && state.ota_state == OTA_IDLE &&
      (f.screen == SCREEN_CLOCK || f.screen == SCREEN_DATE)) {
    const uint32_t interval = (f.cycle_interval_s < 5 ? 5 : f.cycle_interval_s) * 1000UL;
    const uint32_t now = f.now_ms == 0 ? 1 : f.now_ms;
    if (state.cycle_last_ms == 0) {
      state.cycle_last_ms = now;  // arm the timer on the first second
    } else if ((uint32_t)(now - state.cycle_last_ms) >= interval) {
      state.cycle_last_ms = now;
      report.screen_changed = true;
      report.screen = f.screen == SCREEN_CLOCK ? SCREEN_DATE : SCREEN_CLOCK;
    }
  } else if (!f.auto_cycle) {
    state.cycle_last_ms = 0;
  }
}

// Main entry point: draw one frame and report what changed.
inline void render(Canvas &canvas, const GlyphFont &font, const GlyphFont &fallback, const Frame &f, Report &report) {
  report = Report();
  const int width = canvas.width();
  const int height = canvas.height();

  housekeeping(f, report);
  const uint8_t mode = effective_mode(f);
  const GlyphFont *active = &font;

  // Report the mode/OTA/countdown changes once, so the YAML side can publish.
  if ((int) mode != state.reported_mode) {
    state.reported_mode = mode;
    report.mode_changed = true;
    report.mode = mode;
    report.mode_name = mode_name(mode);
  }
  if ((int) state.ota_state != state.reported_ota_state) {
    state.reported_ota_state = state.ota_state;
    report.ota_state_changed = true;
    report.ota_state = state.ota_state;
    report.ota_state_name = ota_state_name(state.ota_state);
  }
  if ((int) state.ota_percent != state.reported_percent) {
    state.reported_percent = state.ota_percent;
    report.percent_changed = true;
    report.percent = state.ota_percent;
  }
  const int remaining_s = state.countdown_deadline_ms == 0
                              ? -1
                              : (int) ((int32_t)(state.countdown_deadline_ms - f.now_ms) > 0
                                           ? (state.countdown_deadline_ms - f.now_ms) / 1000UL
                                           : 0);
  if (remaining_s != state.reported_remaining_s) {
    state.reported_remaining_s = remaining_s;
    report.remaining_changed = true;
    report.remaining_s = remaining_s;
  }

  // Bitmap test screens never draw text.
  if (mode == MODE_GRID_TEST || mode == MODE_PIXEL_TEST) {
    state.anim_active = false;
    state.anim_prev[0] = '\0';
    state.anim_prev_mode = -1;
    draw_bitmap_test(canvas, mode);
    return;
  }

  // The OTA screen owns its own text and progress bar.
  if (mode == MODE_OTA) {
    state.anim_active = false;
    draw_ota(canvas, *active, state.ota_state, state.ota_percent, state.ota_error, active->centered_box_top(height));
    return;
  }

  // Free text (message or alert) scrolls or is centred depending on width.
  if (mode == MODE_MESSAGE) {
    const bool alert = temporary_screen_active(state.alert_active, f.now_ms, state.alert_deadline_ms);
    const char *text = alert ? state.alert_text : state.message_text;
    uint32_t started = alert ? state.alert_started_ms : state.message_started_ms;
    if (state.scroll_hash != hash_text(text)) {
      state.scroll_hash = hash_text(text);
      state.scroll_started_ms = f.now_ms;
    }
    if (state.scroll_started_ms != 0) started = state.scroll_started_ms;
    draw_free_text(canvas, *active, text, (uint32_t)(f.now_ms - started), f.message_scroll, f.scroll_ms_per_px,
                   fallback.centered_box_top(height));
    return;
  }

  // Fixed-width text screens (clock, date, countdown).
  char content[24] = {0};
  bool with_seconds = (mode == MODE_CLOCK) && (f.seconds_mode == SECONDS_DIGITS) && f.time_valid;
  bool has_content = build_content(f, mode, with_seconds, content, sizeof(content));
  if (has_content && active->text_width(content) > width) {
    // 1. drop the seconds digits, keep the bottom-row bar
    if (with_seconds) {
      with_seconds = false;
      has_content = build_content(f, mode, false, content, sizeof(content));
    }
    // 2. fall back to the built-in font, which always fits the default layout
    if (has_content && active->text_width(content) > width) active = &fallback;
  }
  if (!has_content) {
    // No valid time yet: keep a readable, non-empty placeholder.
    snprintf(content, sizeof(content), "--:--");
    active = &fallback;
  }

  // Slide-up animation: only for unchanged layouts (same mode and length).
  const bool same_layout = state.anim_prev_mode == (int) mode && (int) strlen(state.anim_prev) == (int) strlen(content);
  if (!same_layout) {
    state.anim_active = false;
    snprintf(state.anim_prev, sizeof(state.anim_prev), "%s", content);
    state.anim_prev_mode = mode;
  } else if (strcmp(state.anim_prev, content) != 0) {
    if (f.animate && f.animation_ms > 0) {
      if (!state.anim_active) state.anim_started_ms = f.now_ms;  // keep in-flight timing
      state.anim_active = true;
    } else {
      state.anim_active = false;
    }
  }

  float progress = 1.0f;
  if (state.anim_active) {
    progress = (float) (uint32_t)(f.now_ms - state.anim_started_ms) / (float) f.animation_ms;
    if (progress >= 1.0f) {
      progress = 1.0f;
      state.anim_active = false;
    }
  }
  if (!state.anim_active) snprintf(state.anim_prev, sizeof(state.anim_prev), "%s", content);

  // Blinking colon: keep the separators off during the odd second when enabled.
  char draw_content[24];
  snprintf(draw_content, sizeof(draw_content), "%s", content);
  if (mode == MODE_CLOCK && f.blink_colon && f.time_valid && (f.second % 2) != 0) {
    for (char *p = draw_content; *p != '\0'; p++)
      if (*p == ':') *p = ' ';
  }

  const int box_top = active->centered_box_top(height);
  draw_line(canvas, *active, draw_content, state.anim_active ? state.anim_prev : nullptr, progress, f.alignment,
            box_top);

  // Seconds alternative: full-width progress bar on the bottom row.
  if (mode == MODE_CLOCK && f.seconds_mode == SECONDS_BAR && f.time_valid) draw_seconds_bar(canvas, f.second);
}

// Convenience overload used by the YAML display lambda.
inline Report report;
inline void render(Canvas &canvas, const GlyphFont &font, const GlyphFont &fallback, const Frame &f) {
  render(canvas, font, fallback, f, report);
}

}  // namespace max7219_clock
