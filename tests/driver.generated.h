// GENERATED exact ESPHome MAX7219 transmission; do not duplicate transforms in tests.
void StockDriver::send64pixels(uint8_t chip, const uint8_t pixels[8]) {
  for (uint8_t col = 0; col < 8; col++) {  // RUN THIS LOOP 8 times until column is 7
    this->enable();                        // start sending by enabling SPI
    for (uint8_t i = 0; i < chip; i++) {   // send extra NOPs to push the pixels out to extra displays
      this->send_byte_(MAX7219_REGISTER_NOOP,
                       MAX7219_REGISTER_NOOP);  // run this loop unit the matching chip is reached
    }
    uint8_t b = 0;  // rotate pixels 90 degrees -- set byte to 0
    if (this->orientation_ == 0) {
      for (uint8_t i = 0; i < 8; i++) {
        // run this loop 8 times for all the pixels[8] received
        if (this->flip_x_) {
          b |= ((pixels[i] >> col) & 1) << i;  // change the column bits into row bits
        } else {
          b |= ((pixels[i] >> col) & 1) << (7 - i);  // change the column bits into row bits
        }
      }
    } else if (this->orientation_ == 1) {
      if (this->flip_x_) {
        b = pixels[7 - col];
      } else {
        b = pixels[col];
      }
    } else if (this->orientation_ == 2) {
      for (uint8_t i = 0; i < 8; i++) {
        if (this->flip_x_) {
          b |= ((pixels[i] >> (7 - col)) & 1) << (7 - i);
        } else {
          b |= ((pixels[i] >> (7 - col)) & 1) << i;
        }
      }
    } else {
      for (uint8_t i = 0; i < 8; i++) {
        if (this->flip_x_) {
          b |= ((pixels[col] >> i) & 1) << (7 - i);
        } else {
          b |= ((pixels[7 - col] >> i) & 1) << (7 - i);
        }
      }
    }
    // send this byte to display at selected chip
    if (this->invert_) {
      this->send_byte_(col + 1, ~b);
    } else {
      this->send_byte_(col + 1, b);
    }
    for (int i = 0; i < this->num_chips_ - chip - 1; i++)  // end with enough NOPs so later chips don't update
      this->send_byte_(MAX7219_REGISTER_NOOP, MAX7219_REGISTER_NOOP);
    this->disable();  // all done disable SPI
  }                   // end of for each column
}  // end of send64pixels
