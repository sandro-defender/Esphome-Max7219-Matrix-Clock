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
static const uint8_t font_matrix_2px_source_48_data[] = {255,252,243,207,63,255};
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
static const uint8_t font_mg_minecraft_georgian_source_32_data[] = {0};
static const uint8_t font_mg_minecraft_georgian_source_33_data[] = {244};
static const uint8_t font_mg_minecraft_georgian_source_37_data[] = {26,4,73};
static const uint8_t font_mg_minecraft_georgian_source_43_data[] = {39,200,64};
static const uint8_t font_mg_minecraft_georgian_source_45_data[] = {240};
static const uint8_t font_mg_minecraft_georgian_source_46_data[] = {128};
static const uint8_t font_mg_minecraft_georgian_source_47_data[] = {18,4,72};
static const uint8_t font_mg_minecraft_georgian_source_48_data[] = {105,189,150};
static const uint8_t font_mg_minecraft_georgian_source_49_data[] = {35,8,66,124};
static const uint8_t font_mg_minecraft_georgian_source_50_data[] = {105,6,143};
static const uint8_t font_mg_minecraft_georgian_source_51_data[] = {105,7,150};
static const uint8_t font_mg_minecraft_georgian_source_52_data[] = {53,159,17};
static const uint8_t font_mg_minecraft_georgian_source_53_data[] = {248,225,150};
static const uint8_t font_mg_minecraft_georgian_source_54_data[] = {36,143,150};
static const uint8_t font_mg_minecraft_georgian_source_55_data[] = {249,16,34};
static const uint8_t font_mg_minecraft_georgian_source_56_data[] = {105,15,150};
static const uint8_t font_mg_minecraft_georgian_source_57_data[] = {105,23,36};
static const uint8_t font_mg_minecraft_georgian_source_58_data[] = {136};
static const uint8_t font_mg_minecraft_georgian_source_63_data[] = {105,6,4};
static const uint8_t font_mg_minecraft_georgian_source_4304_data[] = {66,150};
static const uint8_t font_mg_minecraft_georgian_source_4305_data[] = {68,6,150};
static const uint8_t font_mg_minecraft_georgian_source_4306_data[] = {24,10,128};
static const uint8_t font_mg_minecraft_georgian_source_4307_data[] = {79,192,67};
static const uint8_t font_mg_minecraft_georgian_source_4308_data[] = {105,25,96};
static const uint8_t font_mg_minecraft_georgian_source_4309_data[] = {105,41,96};
static const uint8_t font_mg_minecraft_georgian_source_4310_data[] = {197,56,114,140};
static const uint8_t font_mg_minecraft_georgian_source_4311_data[] = {90,186,211};
static const uint8_t font_mg_minecraft_georgian_source_4312_data[] = {116,98,160};
static const uint8_t font_mg_minecraft_georgian_source_4313_data[] = {16,41,96};
static const uint8_t font_mg_minecraft_georgian_source_4314_data[] = {105,132,194};
static const uint8_t font_mg_minecraft_georgian_source_4315_data[] = {105,23,150};
static const uint8_t font_mg_minecraft_georgian_source_4316_data[] = {104,142,150};
static const uint8_t font_mg_minecraft_georgian_source_4317_data[] = {122,184,210};
static const uint8_t font_mg_minecraft_georgian_source_4318_data[] = {66,18,150};
static const uint8_t font_mg_minecraft_georgian_source_4319_data[] = {51,121,96};
static const uint8_t font_mg_minecraft_georgian_source_4320_data[] = {72,142,154};
static const uint8_t font_mg_minecraft_georgian_source_4321_data[] = {136,138,150};
static const uint8_t font_mg_minecraft_georgian_source_4322_data[] = {66,153,96};
static const uint8_t font_mg_minecraft_georgian_source_4323_data[] = {109,25,96};
static const uint8_t font_mg_minecraft_georgian_source_4324_data[] = {109,105,96};
static const uint8_t font_mg_minecraft_georgian_source_4325_data[] = {23,81,150};
static const uint8_t font_mg_minecraft_georgian_source_4326_data[] = {107,74,32};
static const uint8_t font_mg_minecraft_georgian_source_4327_data[] = {145,121,96};
static const uint8_t font_mg_minecraft_georgian_source_4328_data[] = {109,23,150};
static const uint8_t font_mg_minecraft_georgian_source_4329_data[] = {106,238,154};
static const uint8_t font_mg_minecraft_georgian_source_4330_data[] = {105,169,96};
static const uint8_t font_mg_minecraft_georgian_source_4331_data[] = {17,23,150};
static const uint8_t font_mg_minecraft_georgian_source_4332_data[] = {109,142,150};
static const uint8_t font_mg_minecraft_georgian_source_4333_data[] = {103,98,150};
static const uint8_t font_mg_minecraft_georgian_source_4334_data[] = {136,142,150};
static const uint8_t font_mg_minecraft_georgian_source_4335_data[] = {70,2,150};
static const uint8_t font_mg_minecraft_georgian_source_4336_data[] = {22,22,150};
static const Glyph font_mg_minecraft_georgian_source_glyphs[] = {
  Glyph(32, font_mg_minecraft_georgian_source_32_data, 5, 0, 5, 1, 1),
  Glyph(33, font_mg_minecraft_georgian_source_33_data, 2, 0, 0, 1, 6),
  Glyph(37, font_mg_minecraft_georgian_source_37_data, 5, 0, 0, 4, 6),
  Glyph(43, font_mg_minecraft_georgian_source_43_data, 4, -1, 2, 5, 4),
  Glyph(45, font_mg_minecraft_georgian_source_45_data, 5, 0, 3, 4, 1),
  Glyph(46, font_mg_minecraft_georgian_source_46_data, 2, 0, 5, 1, 1),
  Glyph(47, font_mg_minecraft_georgian_source_47_data, 5, 0, 0, 4, 6),
  Glyph(48, font_mg_minecraft_georgian_source_48_data, 5, 0, 0, 4, 6),
  Glyph(49, font_mg_minecraft_georgian_source_49_data, 5, -1, 0, 5, 6),
  Glyph(50, font_mg_minecraft_georgian_source_50_data, 5, 0, 0, 4, 6),
  Glyph(51, font_mg_minecraft_georgian_source_51_data, 5, 0, 0, 4, 6),
  Glyph(52, font_mg_minecraft_georgian_source_52_data, 5, 0, 0, 4, 6),
  Glyph(53, font_mg_minecraft_georgian_source_53_data, 5, 0, 0, 4, 6),
  Glyph(54, font_mg_minecraft_georgian_source_54_data, 5, 0, 0, 4, 6),
  Glyph(55, font_mg_minecraft_georgian_source_55_data, 5, 0, 0, 4, 6),
  Glyph(56, font_mg_minecraft_georgian_source_56_data, 5, 0, 0, 4, 6),
  Glyph(57, font_mg_minecraft_georgian_source_57_data, 5, 0, 0, 4, 6),
  Glyph(58, font_mg_minecraft_georgian_source_58_data, 2, 0, 1, 1, 5),
  Glyph(63, font_mg_minecraft_georgian_source_63_data, 5, 0, 0, 4, 6),
  Glyph(4304, font_mg_minecraft_georgian_source_4304_data, 5, 0, 2, 4, 4),
  Glyph(4305, font_mg_minecraft_georgian_source_4305_data, 5, 0, 0, 4, 6),
  Glyph(4306, font_mg_minecraft_georgian_source_4306_data, 4, 0, 0, 3, 6),
  Glyph(4307, font_mg_minecraft_georgian_source_4307_data, 5, 0, 0, 4, 6),
  Glyph(4308, font_mg_minecraft_georgian_source_4308_data, 5, 0, 1, 4, 5),
  Glyph(4309, font_mg_minecraft_georgian_source_4309_data, 5, 0, 1, 4, 5),
  Glyph(4310, font_mg_minecraft_georgian_source_4310_data, 6, 0, 0, 5, 6),
  Glyph(4311, font_mg_minecraft_georgian_source_4311_data, 6, 0, 2, 6, 4),
  Glyph(4312, font_mg_minecraft_georgian_source_4312_data, 6, 0, 2, 5, 4),
  Glyph(4313, font_mg_minecraft_georgian_source_4313_data, 5, 0, 1, 4, 5),
  Glyph(4314, font_mg_minecraft_georgian_source_4314_data, 5, 0, 0, 4, 6),
  Glyph(4315, font_mg_minecraft_georgian_source_4315_data, 5, 0, 0, 4, 6),
  Glyph(4316, font_mg_minecraft_georgian_source_4316_data, 5, 0, 0, 4, 6),
  Glyph(4317, font_mg_minecraft_georgian_source_4317_data, 6, 0, 2, 6, 4),
  Glyph(4318, font_mg_minecraft_georgian_source_4318_data, 5, 0, 0, 4, 6),
  Glyph(4319, font_mg_minecraft_georgian_source_4319_data, 5, 0, 1, 4, 5),
  Glyph(4320, font_mg_minecraft_georgian_source_4320_data, 5, 0, 0, 4, 6),
  Glyph(4321, font_mg_minecraft_georgian_source_4321_data, 5, 0, 0, 4, 6),
  Glyph(4322, font_mg_minecraft_georgian_source_4322_data, 5, 0, 1, 4, 5),
  Glyph(4323, font_mg_minecraft_georgian_source_4323_data, 5, 0, 1, 4, 5),
  Glyph(4324, font_mg_minecraft_georgian_source_4324_data, 5, 0, 1, 4, 5),
  Glyph(4325, font_mg_minecraft_georgian_source_4325_data, 5, 0, 0, 4, 6),
  Glyph(4326, font_mg_minecraft_georgian_source_4326_data, 5, 0, 1, 4, 5),
  Glyph(4327, font_mg_minecraft_georgian_source_4327_data, 5, 0, 1, 4, 5),
  Glyph(4328, font_mg_minecraft_georgian_source_4328_data, 5, 0, 0, 4, 6),
  Glyph(4329, font_mg_minecraft_georgian_source_4329_data, 5, 0, 0, 4, 6),
  Glyph(4330, font_mg_minecraft_georgian_source_4330_data, 5, 0, 1, 4, 5),
  Glyph(4331, font_mg_minecraft_georgian_source_4331_data, 5, 0, 0, 4, 6),
  Glyph(4332, font_mg_minecraft_georgian_source_4332_data, 5, 0, 0, 4, 6),
  Glyph(4333, font_mg_minecraft_georgian_source_4333_data, 5, 0, 0, 4, 6),
  Glyph(4334, font_mg_minecraft_georgian_source_4334_data, 5, 0, 0, 4, 6),
  Glyph(4335, font_mg_minecraft_georgian_source_4335_data, 5, 0, 1, 4, 6),
  Glyph(4336, font_mg_minecraft_georgian_source_4336_data, 5, 0, 0, 4, 6)
};
struct FixtureFont { const char *id; const Glyph *glyphs; int count; int height; };
static const FixtureFont FIXTURE_FONTS[] = {
  {"font_pixel_clock_6x8_source", font_pixel_clock_6x8_source_glyphs, 19, 8},
  {"font_matrix_2px_source", font_matrix_2px_source_glyphs, 19, 8},
  {"font_md_parola_numeric_7seg_source", font_md_parola_numeric_7seg_source_glyphs, 19, 8},
  {"font_md_max72xx_system_source", font_md_max72xx_system_source_glyphs, 19, 8},
  {"font_dot_matrix_source", font_dot_matrix_source_glyphs, 19, 8},
  {"font_mg_minecraft_georgian_source", font_mg_minecraft_georgian_source_glyphs, 52, 8}
};
}}  // namespace esphome::font
