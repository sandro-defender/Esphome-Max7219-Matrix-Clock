// GENERATED from the actual display writer; tests must not duplicate its bindings/clamps.
#pragma once
inline void fixture_preferences(max7219_clock::Frame &frame, const std::map<std::string, std::string> &values) {
frame.screen = max7219_clock::screen_from_option(S(values.at("screen")));
frame.alignment = max7219_clock::alignment_from_option(S(values.at("alignment")));
frame.seconds_mode = max7219_clock::seconds_from_option(S(values.at("secondsMode")));
frame.date_format = max7219_clock::date_format_from_option(S(values.at("dateFormat")));
frame.use_12h = S(values.at("hourFormat")) == "12 hour";
frame.blink_colon = N(values.at("blinkColon"));
frame.animate = N(values.at("digitAnimation"));
frame.animation_ms = max7219_clock::clamp_u32((int) N(values.at("animationMs")), 0, 2000);
frame.animation_row_gap = max7219_clock::clamp_u8((int) N(values.at("animationRowGap")), 0, 2);
frame.message_scroll = S(values.at("scrollMode")) == "Scroll";
frame.scroll_ms_per_px = max7219_clock::clamp_u32((int) N(values.at("scrollSpeed")), 20, 200);
frame.date_scroll_ms_per_px = max7219_clock::clamp_u32((int) N(values.at("dateScrollSpeed")), 20, 200);
frame.ota_brightness = N(values.at("otaBrightness"));
frame.night_manual = N(values.at("nightManual"));
frame.alarm_mode = N(values.at("alarmMode"));
frame.night_schedule = N(values.at("nightDim"));
frame.night_start_hour = (int) N(values.at("nightStart"));
frame.night_end_hour = (int) N(values.at("nightEnd"));
frame.brightness_day = N(values.at("brightness"));
frame.brightness_night = N(values.at("nightBrightness"));
frame.auto_cycle = N(values.at("autoCycle"));
frame.cycle_interval_s = (uint32_t) N(values.at("cycleInterval"));
frame.date_cycle_interval_s = (uint32_t) N(values.at("dateScreenDuration"));

}
