// GENERATED test data: official ESPHome glyph API and packed bpp: 1 data.
// Regenerate with web-configurator/scripts/generate_glyphs.py.
#pragma once
#include <stdint.h>
namespace esphome { namespace font {
class Glyph final {
 public:
  constexpr Glyph(uint32_t code_point, const uint8_t *data, int advance, int offset_x, int offset_y, int width,
                  int height)
      : code_point(code_point),
        data(data),
        advance(advance),
        offset_x(offset_x),
        offset_y(offset_y),
        width(width),
        height(height) {}

  bool is_less_or_equal(uint32_t other) const { return this->code_point <= other; }

  const uint32_t code_point;
  const uint8_t *data;
  int advance;
  int offset_x;
  int offset_y;
  int width;
  int height;
};
static const uint8_t font_pixel_clock_6x8_source_32_data[] = {0};
static const uint8_t font_pixel_clock_6x8_source_33_data[] = {250};
static const uint8_t font_pixel_clock_6x8_source_37_data[] = {206,68,68,78,96};
static const uint8_t font_pixel_clock_6x8_source_43_data[] = {33,62,66,0};
static const uint8_t font_pixel_clock_6x8_source_45_data[] = {240};
static const uint8_t font_pixel_clock_6x8_source_46_data[] = {128};
static const uint8_t font_pixel_clock_6x8_source_47_data[] = {8,68,68,66,0};
static const uint8_t font_pixel_clock_6x8_source_48_data[] = {123,60,243,207,60,222};
static const uint8_t font_pixel_clock_6x8_source_49_data[] = {110,102,102,111};
static const uint8_t font_pixel_clock_6x8_source_50_data[] = {123,48,198,49,140,63};
static const uint8_t font_pixel_clock_6x8_source_51_data[] = {123,48,206,12,60,222};
static const uint8_t font_pixel_clock_6x8_source_52_data[] = {28,246,243,207,240,195};
static const uint8_t font_pixel_clock_6x8_source_53_data[] = {255,12,62,12,60,222};
static const uint8_t font_pixel_clock_6x8_source_54_data[] = {123,60,62,207,60,222};
static const uint8_t font_pixel_clock_6x8_source_55_data[] = {252,48,198,48,195,12};
static const uint8_t font_pixel_clock_6x8_source_56_data[] = {123,60,222,207,60,222};
static const uint8_t font_pixel_clock_6x8_source_57_data[] = {123,60,243,124,60,222};
static const uint8_t font_pixel_clock_6x8_source_58_data[] = {144};
static const uint8_t font_pixel_clock_6x8_source_63_data[] = {240,66,228,1,0};
static const Glyph font_pixel_clock_6x8_source_glyphs[] = {
  Glyph(32, font_pixel_clock_6x8_source_32_data, 3, 0, 7, 1, 1),
  Glyph(33, font_pixel_clock_6x8_source_33_data, 3, 0, 0, 1, 7),
  Glyph(37, font_pixel_clock_6x8_source_37_data, 6, 0, 0, 5, 7),
  Glyph(43, font_pixel_clock_6x8_source_43_data, 6, 0, 1, 5, 5),
  Glyph(45, font_pixel_clock_6x8_source_45_data, 5, 0, 3, 4, 1),
  Glyph(46, font_pixel_clock_6x8_source_46_data, 3, 0, 6, 1, 1),
  Glyph(47, font_pixel_clock_6x8_source_47_data, 6, 0, 0, 5, 7),
  Glyph(48, font_pixel_clock_6x8_source_48_data, 7, 0, 0, 6, 8),
  Glyph(49, font_pixel_clock_6x8_source_49_data, 7, 0, 0, 4, 8),
  Glyph(50, font_pixel_clock_6x8_source_50_data, 7, 0, 0, 6, 8),
  Glyph(51, font_pixel_clock_6x8_source_51_data, 7, 0, 0, 6, 8),
  Glyph(52, font_pixel_clock_6x8_source_52_data, 7, 0, 0, 6, 8),
  Glyph(53, font_pixel_clock_6x8_source_53_data, 7, 0, 0, 6, 8),
  Glyph(54, font_pixel_clock_6x8_source_54_data, 7, 0, 0, 6, 8),
  Glyph(55, font_pixel_clock_6x8_source_55_data, 7, 0, 0, 6, 8),
  Glyph(56, font_pixel_clock_6x8_source_56_data, 7, 0, 0, 6, 8),
  Glyph(57, font_pixel_clock_6x8_source_57_data, 7, 0, 0, 6, 8),
  Glyph(58, font_pixel_clock_6x8_source_58_data, 3, 0, 2, 1, 4),
  Glyph(63, font_pixel_clock_6x8_source_63_data, 6, 0, 0, 5, 7)
};
static const uint8_t font_matrix_2px_source_32_data[] = {0};
static const uint8_t font_matrix_2px_source_33_data[] = {255,207};
static const uint8_t font_matrix_2px_source_37_data[] = {193,140,48,193,152,49,131};
static const uint8_t font_matrix_2px_source_43_data[] = {48,195,63,252,195,12};
static const uint8_t font_matrix_2px_source_45_data[] = {255};
static const uint8_t font_matrix_2px_source_46_data[] = {240};
static const uint8_t font_matrix_2px_source_47_data[] = {24,204,108,96};
static const uint8_t font_matrix_2px_source_48_data[] = {207,60,243,207,63,255};
static const uint8_t font_matrix_2px_source_49_data[] = {255,51,51,51};
static const uint8_t font_matrix_2px_source_50_data[] = {255,240,255,255,15,255};
static const uint8_t font_matrix_2px_source_51_data[] = {255,240,255,252,63,255};
static const uint8_t font_matrix_2px_source_52_data[] = {207,60,255,252,48,195};
static const uint8_t font_matrix_2px_source_53_data[] = {255,252,63,252,63,255};
static const uint8_t font_matrix_2px_source_54_data[] = {255,252,63,255,63,255};
static const uint8_t font_matrix_2px_source_55_data[] = {255,240,195,12,48,195};
static const uint8_t font_matrix_2px_source_56_data[] = {255,252,255,255,63,255};
static const uint8_t font_matrix_2px_source_57_data[] = {255,252,255,252,63,255};
static const uint8_t font_matrix_2px_source_58_data[] = {240,240};
static const uint8_t font_matrix_2px_source_63_data[] = {255,240,195,48,3,12};
static const Glyph font_matrix_2px_source_glyphs[] = {
  Glyph(32, font_matrix_2px_source_32_data, 3, 0, 7, 1, 1),
  Glyph(33, font_matrix_2px_source_33_data, 4, 1, 0, 2, 8),
  Glyph(37, font_matrix_2px_source_37_data, 7, 0, 0, 7, 8),
  Glyph(43, font_matrix_2px_source_43_data, 7, 0, 0, 6, 8),
  Glyph(45, font_matrix_2px_source_45_data, 5, 0, 3, 4, 2),
  Glyph(46, font_matrix_2px_source_46_data, 3, 0, 6, 2, 2),
  Glyph(47, font_matrix_2px_source_47_data, 7, 1, 1, 5, 6),
  Glyph(48, font_matrix_2px_source_48_data, 7, 0, 0, 6, 8),
  Glyph(49, font_matrix_2px_source_49_data, 7, 2, 0, 4, 8),
  Glyph(50, font_matrix_2px_source_50_data, 7, 0, 0, 6, 8),
  Glyph(51, font_matrix_2px_source_51_data, 7, 0, 0, 6, 8),
  Glyph(52, font_matrix_2px_source_52_data, 7, 0, 0, 6, 8),
  Glyph(53, font_matrix_2px_source_53_data, 7, 0, 0, 6, 8),
  Glyph(54, font_matrix_2px_source_54_data, 7, 0, 0, 6, 8),
  Glyph(55, font_matrix_2px_source_55_data, 7, 0, 0, 6, 8),
  Glyph(56, font_matrix_2px_source_56_data, 7, 0, 0, 6, 8),
  Glyph(57, font_matrix_2px_source_57_data, 7, 0, 0, 6, 8),
  Glyph(58, font_matrix_2px_source_58_data, 3, 0, 1, 2, 6),
  Glyph(63, font_matrix_2px_source_63_data, 7, 0, 0, 6, 8)
};
static const uint8_t font_md_parola_numeric_7seg_source_32_data[] = {0};
static const uint8_t font_md_parola_numeric_7seg_source_33_data[] = {250};
static const uint8_t font_md_parola_numeric_7seg_source_37_data[] = {206,68,68,78,96};
static const uint8_t font_md_parola_numeric_7seg_source_43_data[] = {33,62,66,0};
static const uint8_t font_md_parola_numeric_7seg_source_45_data[] = {240};
static const uint8_t font_md_parola_numeric_7seg_source_46_data[] = {128};
static const uint8_t font_md_parola_numeric_7seg_source_47_data[] = {8,68,68,66,0};
static const uint8_t font_md_parola_numeric_7seg_source_48_data[] = {252,99,24,199,224};
static const uint8_t font_md_parola_numeric_7seg_source_49_data[] = {254};
static const uint8_t font_md_parola_numeric_7seg_source_50_data[] = {248,67,248,67,224};
static const uint8_t font_md_parola_numeric_7seg_source_51_data[] = {248,67,240,135,224};
static const uint8_t font_md_parola_numeric_7seg_source_52_data[] = {140,99,240,132,32};
static const uint8_t font_md_parola_numeric_7seg_source_53_data[] = {252,33,240,135,224};
static const uint8_t font_md_parola_numeric_7seg_source_54_data[] = {252,33,248,199,224};
static const uint8_t font_md_parola_numeric_7seg_source_55_data[] = {248,66,16,132,32};
static const uint8_t font_md_parola_numeric_7seg_source_56_data[] = {252,99,248,199,224};
static const uint8_t font_md_parola_numeric_7seg_source_57_data[] = {252,99,240,135,224};
static const uint8_t font_md_parola_numeric_7seg_source_58_data[] = {160};
static const uint8_t font_md_parola_numeric_7seg_source_63_data[] = {240,66,228,1,0};
static const Glyph font_md_parola_numeric_7seg_source_glyphs[] = {
  Glyph(32, font_md_parola_numeric_7seg_source_32_data, 1, 0, 7, 1, 1),
  Glyph(33, font_md_parola_numeric_7seg_source_33_data, 1, 0, 0, 1, 7),
  Glyph(37, font_md_parola_numeric_7seg_source_37_data, 5, 0, 0, 5, 7),
  Glyph(43, font_md_parola_numeric_7seg_source_43_data, 5, 0, 1, 5, 5),
  Glyph(45, font_md_parola_numeric_7seg_source_45_data, 4, 0, 3, 4, 1),
  Glyph(46, font_md_parola_numeric_7seg_source_46_data, 1, 0, 6, 1, 1),
  Glyph(47, font_md_parola_numeric_7seg_source_47_data, 5, 0, 0, 5, 7),
  Glyph(48, font_md_parola_numeric_7seg_source_48_data, 5, 0, 0, 5, 7),
  Glyph(49, font_md_parola_numeric_7seg_source_49_data, 5, 0, 0, 1, 7),
  Glyph(50, font_md_parola_numeric_7seg_source_50_data, 5, 0, 0, 5, 7),
  Glyph(51, font_md_parola_numeric_7seg_source_51_data, 5, 0, 0, 5, 7),
  Glyph(52, font_md_parola_numeric_7seg_source_52_data, 5, 0, 0, 5, 7),
  Glyph(53, font_md_parola_numeric_7seg_source_53_data, 5, 0, 0, 5, 7),
  Glyph(54, font_md_parola_numeric_7seg_source_54_data, 5, 0, 0, 5, 7),
  Glyph(55, font_md_parola_numeric_7seg_source_55_data, 5, 0, 0, 5, 7),
  Glyph(56, font_md_parola_numeric_7seg_source_56_data, 5, 0, 0, 5, 7),
  Glyph(57, font_md_parola_numeric_7seg_source_57_data, 5, 0, 0, 5, 7),
  Glyph(58, font_md_parola_numeric_7seg_source_58_data, 1, 0, 2, 1, 3),
  Glyph(63, font_md_parola_numeric_7seg_source_63_data, 5, 0, 0, 5, 7)
};
static const uint8_t font_md_max72xx_system_source_32_data[] = {0};
static const uint8_t font_md_max72xx_system_source_33_data[] = {250};
static const uint8_t font_md_max72xx_system_source_37_data[] = {206,68,68,78,96};
static const uint8_t font_md_max72xx_system_source_43_data[] = {33,62,66,0};
static const uint8_t font_md_max72xx_system_source_45_data[] = {240};
static const uint8_t font_md_max72xx_system_source_46_data[] = {240};
static const uint8_t font_md_max72xx_system_source_47_data[] = {8,68,68,66,0};
static const uint8_t font_md_max72xx_system_source_48_data[] = {116,103,92,197,192};
static const uint8_t font_md_max72xx_system_source_49_data[] = {46,146,72};
static const uint8_t font_md_max72xx_system_source_50_data[] = {240,66,232,67,224};
static const uint8_t font_md_max72xx_system_source_51_data[] = {240,66,224,135,192};
static const uint8_t font_md_max72xx_system_source_52_data[] = {140,99,240,132,32};
static const uint8_t font_md_max72xx_system_source_53_data[] = {252,33,224,135,192};
static const uint8_t font_md_max72xx_system_source_54_data[] = {116,33,232,197,192};
static const uint8_t font_md_max72xx_system_source_55_data[] = {252,66,16,132,32};
static const uint8_t font_md_max72xx_system_source_56_data[] = {116,98,232,197,192};
static const uint8_t font_md_max72xx_system_source_57_data[] = {116,98,240,133,192};
static const uint8_t font_md_max72xx_system_source_58_data[] = {243,192};
static const uint8_t font_md_max72xx_system_source_63_data[] = {240,66,228,1,0};
static const Glyph font_md_max72xx_system_source_glyphs[] = {
  Glyph(32, font_md_max72xx_system_source_32_data, 2, 0, 7, 1, 1),
  Glyph(33, font_md_max72xx_system_source_33_data, 1, 0, 0, 1, 7),
  Glyph(37, font_md_max72xx_system_source_37_data, 5, 0, 0, 5, 7),
  Glyph(43, font_md_max72xx_system_source_43_data, 5, 0, 1, 5, 5),
  Glyph(45, font_md_max72xx_system_source_45_data, 4, 0, 3, 4, 1),
  Glyph(46, font_md_max72xx_system_source_46_data, 2, 0, 5, 2, 2),
  Glyph(47, font_md_max72xx_system_source_47_data, 5, 0, 0, 5, 7),
  Glyph(48, font_md_max72xx_system_source_48_data, 5, 0, 0, 5, 7),
  Glyph(49, font_md_max72xx_system_source_49_data, 3, 0, 0, 3, 7),
  Glyph(50, font_md_max72xx_system_source_50_data, 5, 0, 0, 5, 7),
  Glyph(51, font_md_max72xx_system_source_51_data, 5, 0, 0, 5, 7),
  Glyph(52, font_md_max72xx_system_source_52_data, 5, 0, 0, 5, 7),
  Glyph(53, font_md_max72xx_system_source_53_data, 5, 0, 0, 5, 7),
  Glyph(54, font_md_max72xx_system_source_54_data, 5, 0, 0, 5, 7),
  Glyph(55, font_md_max72xx_system_source_55_data, 5, 0, 0, 5, 7),
  Glyph(56, font_md_max72xx_system_source_56_data, 5, 0, 0, 5, 7),
  Glyph(57, font_md_max72xx_system_source_57_data, 5, 0, 0, 5, 7),
  Glyph(58, font_md_max72xx_system_source_58_data, 2, 0, 2, 2, 5),
  Glyph(63, font_md_max72xx_system_source_63_data, 5, 0, 0, 5, 7)
};
static const uint8_t font_dot_matrix_source_32_data[] = {0};
static const uint8_t font_dot_matrix_source_33_data[] = {251};
static const uint8_t font_dot_matrix_source_37_data[] = {199,33,8,66,16,198};
static const uint8_t font_dot_matrix_source_43_data[] = {33,9,255,144,132};
static const uint8_t font_dot_matrix_source_45_data[] = {252};
static const uint8_t font_dot_matrix_source_46_data[] = {192};
static const uint8_t font_dot_matrix_source_47_data[] = {18,36,136};
static const uint8_t font_dot_matrix_source_48_data[] = {123,60,243,207,60,222};
static const uint8_t font_dot_matrix_source_49_data[] = {55,140,99,24,223};
static const uint8_t font_dot_matrix_source_50_data[] = {123,48,198,49,140,63};
static const uint8_t font_dot_matrix_source_51_data[] = {123,48,206,12,60,222};
static const uint8_t font_dot_matrix_source_52_data[] = {24,229,182,252,97,134};
static const uint8_t font_dot_matrix_source_53_data[] = {255,15,131,12,60,222};
static const uint8_t font_dot_matrix_source_54_data[] = {123,60,62,207,60,222};
static const uint8_t font_dot_matrix_source_55_data[] = {252,49,134,48,198,24};
static const uint8_t font_dot_matrix_source_56_data[] = {123,60,222,207,60,222};
static const uint8_t font_dot_matrix_source_57_data[] = {123,60,243,124,60,222};
static const uint8_t font_dot_matrix_source_58_data[] = {144};
static const uint8_t font_dot_matrix_source_63_data[] = {123,48,198,48,3,12};
static const Glyph font_dot_matrix_source_glyphs[] = {
  Glyph(32, font_dot_matrix_source_32_data, 3, 0, 7, 1, 1),
  Glyph(33, font_dot_matrix_source_33_data, 3, 0, 0, 1, 8),
  Glyph(37, font_dot_matrix_source_37_data, 6, 0, 0, 6, 8),
  Glyph(43, font_dot_matrix_source_43_data, 7, 0, 0, 5, 8),
  Glyph(45, font_dot_matrix_source_45_data, 5, 0, 3, 3, 2),
  Glyph(46, font_dot_matrix_source_46_data, 3, 0, 6, 1, 2),
  Glyph(47, font_dot_matrix_source_47_data, 6, 0, 1, 4, 6),
  Glyph(48, font_dot_matrix_source_48_data, 7, 0, 0, 6, 8),
  Glyph(49, font_dot_matrix_source_49_data, 7, 0, 0, 5, 8),
  Glyph(50, font_dot_matrix_source_50_data, 7, 0, 0, 6, 8),
  Glyph(51, font_dot_matrix_source_51_data, 7, 0, 0, 6, 8),
  Glyph(52, font_dot_matrix_source_52_data, 7, 0, 0, 6, 8),
  Glyph(53, font_dot_matrix_source_53_data, 7, 0, 0, 6, 8),
  Glyph(54, font_dot_matrix_source_54_data, 7, 0, 0, 6, 8),
  Glyph(55, font_dot_matrix_source_55_data, 7, 0, 0, 6, 8),
  Glyph(56, font_dot_matrix_source_56_data, 7, 0, 0, 6, 8),
  Glyph(57, font_dot_matrix_source_57_data, 7, 0, 0, 6, 8),
  Glyph(58, font_dot_matrix_source_58_data, 3, 0, 2, 1, 4),
  Glyph(63, font_dot_matrix_source_63_data, 6, 0, 0, 6, 8)
};
struct FixtureFont { const char *id; const Glyph *glyphs; int count; int height; };
static const FixtureFont FIXTURE_FONTS[] = {
  {"font_pixel_clock_6x8_source", font_pixel_clock_6x8_source_glyphs, 19, 8},
  {"font_matrix_2px_source", font_matrix_2px_source_glyphs, 19, 8},
  {"font_md_parola_numeric_7seg_source", font_md_parola_numeric_7seg_source_glyphs, 19, 8},
  {"font_md_max72xx_system_source", font_md_max72xx_system_source_glyphs, 19, 8},
  {"font_dot_matrix_source", font_dot_matrix_source_glyphs, 19, 8}
};
}}  // namespace esphome::font
