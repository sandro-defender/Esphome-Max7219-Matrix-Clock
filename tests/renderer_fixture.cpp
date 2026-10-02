// Host pixel oracle: actual renderer + SourceFont + exact tagged ESPHome
// glyphs, StringRef, writer preferences and SPI transformation. No YAML/UI
// option tables or font bitmaps are hand-copied into this test harness.
#include <algorithm>
#include <iostream>
#include <map>
#include <memory>
#include <stdexcept>
#include <string>
#include <vector>
#include "string_ref.generated.h"
#include "fonts.generated.h"

namespace esphome {
namespace display {
constexpr bool COLOR_ON = true, COLOR_OFF = false;
class Display {
 public:
  Display(int width, int height) : width_(width), height_(height), pixels(width * height, 0) {}
  int get_width() const { return width_; }
  int get_height() const { return height_; }
  void draw_pixel_at(int x, int y, bool on) {
    if (x < 0 || y < 0 || x >= width_ || y >= height_) { bad_writes++; return; }
    pixels[y * width_ + x] = on;
  }
  void clear() { std::fill(pixels.begin(), pixels.end(), 0); }
  int width_, height_, bad_writes = 0;
  std::vector<uint8_t> pixels;
};
}  // namespace display
namespace font {
// Thin storage-only font facade; metrics/data use the actual public Glyph API.
class Font {
 public:
  explicit Font(const FixtureFont &record) : record_(record) {}
  const Glyph *find_glyph(uint32_t codepoint) const {
    for (int i = 0; i < record_.count; i++) if (record_.glyphs[i].code_point == codepoint) return &record_.glyphs[i];
    return nullptr;
  }
  int get_height() const { return record_.height; }
  const FixtureFont &record_;
};
}  // namespace font
inline uint8_t progmem_read_byte(const uint8_t *p) { return *p; }
}  // namespace esphome
using namespace esphome;
#define USE_FONT
#include "../packages/max7219_clock_esphome.h"

static StringRef S(const std::string &s) { return StringRef(s); }
static float N(const std::string &s) { return s == "true" ? 1 : s == "false" ? 0 : std::stof(s); }
#include "frame.generated.h"

constexpr uint8_t MAX7219_REGISTER_NOOP = 0;
class StockDriver {
 public:
  uint8_t orientation_ = 0;
  bool flip_x_ = false, invert_ = false;
  int num_chips_ = 1;
  uint8_t rows[8] = {};
  void enable() {}
  void disable() {}
  void send_byte_(uint8_t reg, uint8_t byte) { if (reg >= 1 && reg <= 8) rows[reg - 1] = byte; }
  void send64pixels(uint8_t chip, const uint8_t pixels[8]);
};
#include "driver.generated.h"

using Values = std::map<std::string, std::string>;
using namespace max7219_clock;

static bool has(const Values &values, const std::string &key) { return values.find(key) != values.end(); }
static uint32_t as_u32(const std::string &value) { return (uint32_t) std::stoull(value); }
static std::string json_string(const std::string &value) {
  std::string result = "\"";
  for (unsigned char c : value) {
    if (c == '\\' || c == '"') { result += '\\'; result += (char) c; }
    else if (c == '\n') result += "\\n";
    else if (c == '\r') result += "\\r";
    else if (c == '\t') result += "\\t";
    else if (c < 0x20) { char escaped[7]; snprintf(escaped, sizeof(escaped), "\\u%04x", c); result += escaped; }
    else result += (char) c;
  }
  return result + "\"";
}

static std::string visible_pixels(const display::Display &panel, const Values &values, bool priority) {
  const bool powered = priority || N(values.at("displayPower"));
  const bool inverted = !priority && N(values.at("invert"));
  std::vector<uint8_t> visible(panel.width_ * panel.height_, 0);
  for (int my = 0; my < panel.height_; my += 8) for (int mx = 0; mx < panel.width_; mx += 8) {
    uint8_t columns[8] = {};
    const int source_mx = N(values.at("reverseEnable")) ? panel.width_ - mx - 8 : mx;
    for (int y = 0; y < 8; y++) for (int x = 0; x < 8; x++)
      if (panel.pixels[(my+y)*panel.width_ + source_mx+x]) columns[x] |= 1U << y;
    StockDriver driver;
    driver.orientation_ = std::stoi(values.at("rotateChip")) / 90;
    driver.flip_x_ = N(values.at("flipX"));
    driver.invert_ = inverted;
    driver.send64pixels(0, columns);
    for (int y = 0; y < 8; y++) for (int x = 0; x < 8; x++)
      visible[(my+y)*panel.width_ + mx+x] = powered && ((driver.rows[y] >> (7-x)) & 1U);
  }
  std::string bits;
  bits.reserve(visible.size());
  for (uint8_t pixel : visible) bits += pixel ? '1' : '0';
  return bits;
}

static void load_font(const Values &values, display::Display &panel, BuiltinFont &builtin,
                      std::unique_ptr<font::Font> &native, std::unique_ptr<SourceFont> &external,
                      const GlyphFont *&selected) {
  selected = &builtin;
  if (values.at("font") == "compact") return;
  for (const auto &record : font::FIXTURE_FONTS) if (values.at("font") == record.id) {
    native = std::make_unique<font::Font>(record);
    external = std::make_unique<SourceFont>(native.get(), &panel);
    selected = external.get();
    return;
  }
  throw std::runtime_error("Unknown compiled font");
}

static void fill_clock(Frame &frame, const Values &values) {
  fixture_preferences(frame, values);
  frame.time_valid = true;
  frame.hour = std::stoi(values.at("hour"));
  frame.minute = std::stoi(values.at("minute"));
  frame.second = std::stoi(values.at("second"));
  frame.day = std::stoi(values.at("day"));
  frame.month = std::stoi(values.at("month"));
}

static void emit_single(const Values &values) {
  const int width = std::stoi(values.at("width")), height = std::stoi(values.at("height"));
  display::Display panel(width, height);
  DisplayCanvas canvas(panel);
  BuiltinFont builtin;
  const GlyphFont *selected = &builtin;
  std::unique_ptr<font::Font> native;
  std::unique_ptr<SourceFont> external;
  load_font(values, panel, builtin, native, external, selected);

  Frame frame;
  fill_clock(frame, values);
  frame.now_ms = 1000;
  state = Runtime();
  const int elapsed = std::stoi(values.at("elapsed"));
  const std::string &message = values.at("message");
  if (!message.empty()) {
    char text[48];
    copy_utf8_truncated(text, sizeof(text), message.c_str(), message.size());
    upper_ascii(text);
    state.set_message(text, std::stoi(values.at("messageHold")) * 1000UL, frame.now_ms);
  }
  const auto &overlay = values.at("overlay");
  if (overlay == "boot") state.begin_boot(values.at("version").c_str(), std::stoi(values.at("bootVersionMs")), frame.now_ms);
  else if (overlay != "none") {
    state.begin_ota(N(values.at("displayPower")));
    state.ota_state = std::stoi(overlay);
    state.ota_percent = ota_progress_percent(N(values.at("percent")));
    state.ota_error = std::stoi(values.at("error"));
  }
  Report report;
  render(canvas, *selected, builtin, frame, report);
  if (!values.at("from").empty()) {
    snprintf(state.anim_prev, sizeof(state.anim_prev), "%s", values.at("from").c_str());
    panel.clear();
    render(canvas, *selected, builtin, frame, report);  // start actual transition
  }
  frame.now_ms += elapsed;
  panel.clear();
  render(canvas, *selected, builtin, frame, report);
  const bool priority = state.ota_state != OTA_IDLE || state.boot_active;
  std::cout << "{\"pixels\":" << json_string(visible_pixels(panel, values, priority))
            << ",\"brightness\":" << state.applied_brightness
            << ",\"mode\":" << json_string(mode_name(effective_mode(frame)))
            << ",\"badWrites\":" << panel.bad_writes << "}" << std::endl;
}

static Values step_values(const Values &all, int index) {
  const std::string prefix = "step" + std::to_string(index) + ".";
  Values result;
  for (const auto &entry : all) if (entry.first.compare(0, prefix.size(), prefix) == 0)
    result[entry.first.substr(prefix.size())] = entry.second;
  return result;
}

static void select_screen(Runtime &runtime, const std::string &option, uint32_t now_ms) {
  if (option == "Message") {
    if (runtime.message_text[0] == '\0') runtime.set_message("MAX7219 CLOCK", 0, now_ms);
    else runtime.message_active = true;
  } else {
    runtime.clear_message();
    runtime.clear_alert();
  }
}

static void process_preview_message(Runtime &runtime, const Values &prefs, const std::string &text, uint32_t now_ms) {
  if (text.empty()) {
    runtime.clear_message();
    runtime.clear_alert();
    return;
  }
  char bounded[48];
  copy_utf8_truncated(bounded, sizeof(bounded), text.c_str(), text.size());
  upper_ascii(bounded);
  int seconds = std::stoi(prefs.at("messageHold"));
  if (seconds < 0) seconds = 0;
  if (seconds > 3600) seconds = 3600;
  runtime.set_message(bounded, (uint32_t) seconds * 1000UL, now_ms);
  runtime.clear_alert();
}

static void apply_report_after_draw(const Report &report, std::string &selected_screen) {
  // This is deliberately after render(), as in packages/display.yaml: reports
  // never change the Frame that was just drawn; their select update is visible
  // only to the next sequential frame.
  if (report.mode_changed) {
    switch (report.mode) {
      case MODE_CLOCK:
      case MODE_DATE:
      case MODE_GRID_TEST:
      case MODE_PIXEL_TEST:
        selected_screen = option_for_screen(screen_from_mode(report.mode));
        break;
      default:
        break;
    }
  }
  if (report.screen_changed) selected_screen = option_for_screen(report.screen);
}

static void emit_sequence(const Values &values) {
  const int width = std::stoi(values.at("width")), height = std::stoi(values.at("height"));
  const int count = std::stoi(values.at("steps"));
  display::Display panel(width, height);
  DisplayCanvas canvas(panel);
  BuiltinFont builtin;
  const GlyphFont *selected = &builtin;
  std::unique_ptr<font::Font> native;
  std::unique_ptr<SourceFont> external;
  load_font(values, panel, builtin, native, external, selected);

  state = Runtime();
  std::string selected_screen = values.at("screen");
  std::string requested_screen = selected_screen;
  std::string last_message_input;
  std::string message_input = has(values, "message") ? values.at("message") : "";
  bool have_message_input = false;
  bool initialized_screen = false;
  Values current_prefs = values;

  std::cout << "{\"frames\":[";
  for (int index = 0; index < count; index++) {
    if (index != 0) std::cout << ',';
    const Values overrides = step_values(values, index);
    for (const auto &entry : overrides) {
      if (entry.first != "nowMs" && entry.first != "message")
        current_prefs[entry.first] = entry.second;
    }
    Values prefs = current_prefs;
    const uint32_t now_ms = as_u32(overrides.count("nowMs") ? overrides.at("nowMs") : "1000");
    if (!initialized_screen) {
      initialized_screen = true;
      if (selected_screen == "Message") select_screen(state, selected_screen, now_ms);
    }

    // The caller sends only changed select values. Keep the last user choice
    // separate from Report-driven `selected_screen`: automatic cycling updates
    // the entity after drawing, but must not look like a fresh user selection
    // on the following frame.
    const auto changed_screen = overrides.find("screen");
    if (changed_screen != overrides.end() && changed_screen->second != requested_screen) {
      requested_screen = changed_screen->second;
      selected_screen = requested_screen;
      select_screen(state, requested_screen, now_ms);
    }
    prefs["screen"] = selected_screen;

    if (overrides.count("message")) message_input = overrides.at("message");
    if (!have_message_input || message_input != last_message_input) {
      have_message_input = true;
      last_message_input = message_input;
      process_preview_message(state, prefs, message_input, now_ms);
    }

    Frame frame;
    fill_clock(frame, prefs);
    frame.now_ms = now_ms;
    panel.clear();
    Report report;
    render(canvas, *selected, builtin, frame, report);
    const std::string mode = mode_name(effective_mode(frame));
    const std::string pixels = visible_pixels(panel, prefs, state.ota_state != OTA_IDLE || state.boot_active);
    const bool message_visible = temporary_screen_active(state.message_active, frame.now_ms, state.message_deadline_ms);
    const std::string screen_before_report = prefs.at("screen");

    // Mirror the two post-draw publish_state blocks in the actual display
    // writer. Apply Report feedback only after capturing this frame's output.
    apply_report_after_draw(report, selected_screen);

    std::cout << "{\"pixels\":" << json_string(pixels)
              << ",\"brightness\":" << state.applied_brightness
              << ",\"mode\":" << json_string(mode)
              << ",\"frameScreen\":" << json_string(screen_before_report)
              << ",\"screenAfter\":" << json_string(selected_screen)
              << ",\"screenChanged\":" << (report.screen_changed ? "true" : "false")
              << ",\"screenChange\":" << json_string(report.screen_changed ? option_for_screen(report.screen) : "")
              << ",\"messageActive\":" << (state.message_active ? "true" : "false")
              << ",\"messageVisible\":" << (message_visible ? "true" : "false")
              << ",\"messageDeadline\":" << state.message_deadline_ms
              << ",\"cycleLast\":" << state.cycle_last_ms
              << ",\"lastTick\":" << state.last_tick_ms << "}";
  }
  std::cout << "]}" << std::endl;
}

int main(int argc, char **argv) {
  try {
    Values values;
    for (int i = 1; i < argc; i++) {
      const std::string arg = argv[i];
      const auto split = arg.find('=');
      if (split == std::string::npos) throw std::runtime_error("Expected key=value");
      values[arg.substr(0, split)] = arg.substr(split + 1);
    }
    if (has(values, "steps")) emit_sequence(values);
    else emit_single(values);
  } catch (const std::exception &error) { std::cerr << error.what() << std::endl; return 1; }
}
