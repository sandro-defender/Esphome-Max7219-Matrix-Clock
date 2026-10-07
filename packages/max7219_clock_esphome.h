// ESPHome glue for the pure renderer in max7219_clock_renderer.h.
//
// Two small adapters connect the renderer to ESPHome:
//   * DisplayCanvas  - draws pixels through a display::Display (the MAX7219)
//   * SourceFont     - draws single glyphs with the ESPHome font component so
//                      ESPHome's own metrics (offset_x/offset_y/advance) decide
//                      where the ink lands
// plus a few option-string helpers so the display lambda stays short.
//
// The renderer itself depends on nothing but the C++ standard library and is
// unit tested on a workstation (tests/test_renderer.cpp).

#pragma once

#include <stdint.h>

#include <string>

#include "max7219_clock_renderer.h"

namespace max7219_clock {

// Draws into the ESPHome display buffer. Out-of-bounds pixels are dropped by
// the display component, which is what the renderer expects while animating.
class DisplayCanvas : public Canvas {
 public:
  explicit DisplayCanvas(display::Display &display) : display_(&display) {}
  void pixel(int x, int y, bool on) override {
    // The MAX7219 driver otherwise grows its scroll buffer for off-panel x.
    if (x < 0 || y < 0 || x >= width() || y >= height()) return;
    this->display_->draw_pixel_at(x, y, on ? display::COLOR_ON : display::COLOR_OFF);
  }
  int width() const override { return this->display_->get_width(); }
  int height() const override { return this->display_->get_height(); }

 private:
  display::Display *display_;
};

// Wraps public ESPHome glyph metrics and its continuously packed 1bpp data.
// All pixels pass through Canvas, including per-cell animation clipping.
#ifdef USE_FONT
class SourceFont : public GlyphFont {
 public:
  SourceFont(font::Font *font, display::Display *) : font_(font) {}
  int advance(char c) const override {
    const font::Glyph *glyph = this->font_->find_glyph((uint32_t) (uint8_t) c);
    return glyph != nullptr ? glyph->advance : 0;
  }
  // Ink height/top of a digit: the clock/countdown text is centred on digits.
  int ink_height() const override {
    const font::Glyph *glyph = this->font_->find_glyph('0');
    return glyph != nullptr ? glyph->height : this->font_->get_height();
  }
  int ink_top() const override {
    const font::Glyph *glyph = this->font_->find_glyph('0');
    return glyph != nullptr ? glyph->offset_y : 0;
  }
  const void *identity() const override { return this->font_; }
  void draw_glyph(Canvas &canvas, char ch, int x, int box_top) const override {
    // All supported faces are bpp: 1. Read ESPHome's compiled, packed glyph
    // through Canvas so per-cell clipping also applies to external fonts.
    // Font::print draws straight into Display and bypasses that clip window.
    const font::Glyph *glyph = this->font_->find_glyph((uint32_t) (uint8_t) ch);
    if (glyph == nullptr) return;
    for (int row = 0; row < glyph->height; row++) {
      for (int col = 0; col < glyph->width; col++) {
        const int bit = row * glyph->width + col;
        if (progmem_read_byte(glyph->data + bit / 8) & (0x80U >> (bit % 8)))
          canvas.pixel(x + glyph->offset_x + col, box_top + glyph->offset_y + row, true);
      }
    }
  }

 private:
  font::Font *font_;
};

#endif  // USE_FONT

// Option-string helpers: the YAML entities carry human readable options, the
// renderer works on the enums from max7219_clock_renderer.h.
template<typename Option> inline uint8_t screen_from_option(const Option &option) {
  if (option == "Date")
    return SCREEN_DATE;
  if (option == "Temperature")
    return SCREEN_TEMPERATURE;
  if (option == "Module grid test")
    return SCREEN_GRID_TEST;
  if (option == "Pixel checkerboard")
    return SCREEN_PIXEL_TEST;
  return SCREEN_CLOCK;
}

template<typename Option> inline uint8_t alignment_from_option(const Option &option) {
  if (option == "Left")
    return ALIGN_LEFT;
  if (option == "Right")
    return ALIGN_RIGHT;
  return ALIGN_CENTER;
}

template<typename Option> inline uint8_t seconds_from_option(const Option &option) {
  if (option == "Off")
    return SECONDS_OFF;
  if (option == "Bar")
    return SECONDS_BAR;
  return SECONDS_DIGITS;
}

template<typename Option> inline uint8_t clock_layout_from_option(const Option &option) {
  if (option == "Clock + weather icon") return CLOCK_LAYOUT_WEATHER_ICON;
  if (option == "Clock + home and outdoor weather") return CLOCK_LAYOUT_HOME_AND_OUTDOOR_WEATHER;
  return CLOCK_LAYOUT_ONLY;
}

template<typename Option> inline uint8_t date_format_from_option(const Option &option) {
  if (option == "MM/DD")
    return DATE_MM_DD;
  if (option == "DD/MM")
    return DATE_DD_MM_SLASH;
  if (option == "DD.MM.YY")
    return DATE_DD_MM_YY;
  if (option == "Weekday DD.MM.YY")
    return DATE_WEEKDAY_DD_MM_YY;
  if (option == "Weekday DD. MMM YY")
    return DATE_WEEKDAY_DD_MMM_YY;
  if (option == "Weekday MMM.DD")
    return DATE_WEEKDAY_MMM_DD;
  return DATE_DD_MM;
}

template<typename Option> inline uint8_t date_language_from_option(const Option &option) {
  return option == "Georgian" ? DATE_LANGUAGE_GEORGIAN : DATE_LANGUAGE_ENGLISH;
}

inline const char *option_for_screen(uint8_t screen) {
  switch (screen) {
    case SCREEN_DATE:
      return "Date";
    case SCREEN_TEMPERATURE:
      return "Temperature";
    case SCREEN_GRID_TEST:
      return "Module grid test";
    case SCREEN_PIXEL_TEST:
      return "Pixel checkerboard";
    default:
      return "Clock";
  }
}

inline uint8_t screen_from_mode(uint8_t mode) {
  switch (mode) {
    case MODE_DATE:
      return SCREEN_DATE;
    case MODE_TEMPERATURE:
      return SCREEN_TEMPERATURE;
    case MODE_GRID_TEST:
      return SCREEN_GRID_TEST;
    case MODE_PIXEL_TEST:
      return SCREEN_PIXEL_TEST;
    default:
      return SCREEN_CLOCK;
  }
}

// Clamp helpers keep entity and action inputs bounded before they reach the
// renderer (see Phase 12 of the roadmap).
inline uint8_t clamp_u8(float value, int min_value, int max_value) {
  int ivalue = (int) (value + (value >= 0 ? 0.5f : -0.5f));
  if (ivalue < min_value) ivalue = min_value;
  if (ivalue > max_value) ivalue = max_value;
  return (uint8_t) ivalue;
}

inline uint32_t clamp_u32(int value, uint32_t min_value, uint32_t max_value) {
  if (value < (int) min_value) return min_value;
  if (value > (int) max_value) return max_value;
  return (uint32_t) value;
}

}  // namespace max7219_clock
