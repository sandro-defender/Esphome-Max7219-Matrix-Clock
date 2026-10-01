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

int main(int argc, char **argv) {
  try {
    std::map<std::string, std::string> values;
    for (int i = 1; i < argc; i++) {
      const std::string arg = argv[i];
      const auto split = arg.find('=');
      if (split == std::string::npos) throw std::runtime_error("Expected key=value");
      values[arg.substr(0, split)] = arg.substr(split + 1);
    }
    using namespace max7219_clock;
    const int width = std::stoi(values.at("width")), height = std::stoi(values.at("height"));
    display::Display panel(width, height);
    DisplayCanvas canvas(panel);
    BuiltinFont builtin;
    const GlyphFont *selected = &builtin;
    std::unique_ptr<font::Font> native;
    std::unique_ptr<SourceFont> external;
    if (values.at("font") != "compact") {
      for (const auto &record : font::FIXTURE_FONTS) if (values.at("font") == record.id) native = std::make_unique<font::Font>(record);
      if (!native) throw std::runtime_error("Unknown compiled font");
      external = std::make_unique<SourceFont>(native.get(), &panel);
      selected = external.get();
    }
    Frame frame;
    fixture_preferences(frame, values);
    frame.now_ms = 1000;
    frame.time_valid = true;
    frame.hour = std::stoi(values.at("hour")); frame.minute = std::stoi(values.at("minute"));
    frame.second = std::stoi(values.at("second")); frame.day = std::stoi(values.at("day")); frame.month = std::stoi(values.at("month"));
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
    const bool powered = priority || N(values.at("displayPower"));
    const bool inverted = !priority && N(values.at("invert"));
    std::vector<uint8_t> visible(width * height, 0);
    for (int my = 0; my < height; my += 8) for (int mx = 0; mx < width; mx += 8) {
      uint8_t columns[8] = {};
      for (int y = 0; y < 8; y++) for (int x = 0; x < 8; x++) if (panel.pixels[(my+y)*width + mx+x]) columns[x] |= 1U << y;
      StockDriver driver;
      driver.orientation_ = std::stoi(values.at("rotateChip")) / 90;
      driver.flip_x_ = N(values.at("flipX"));
      driver.invert_ = inverted;
      driver.send64pixels(0, columns);
      for (int y = 0; y < 8; y++) for (int x = 0; x < 8; x++) visible[(my+y)*width + mx+x] = powered && ((driver.rows[y] >> (7-x)) & 1U);
    }
    std::cout << "{\"pixels\":\"";
    for (uint8_t pixel : visible) std::cout << (pixel ? '1' : '0');
    std::cout << "\",\"brightness\":" << state.applied_brightness << ",\"mode\":\"" << mode_name(effective_mode(frame))
              << "\",\"badWrites\":" << panel.bad_writes << "}" << std::endl;
  } catch (const std::exception &error) { std::cerr << error.what() << std::endl; return 1; }
}
