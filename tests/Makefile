# Host-side regression tests for the pure C++ renderer.
#
#   make -C tests test      build and run the renderer tests
#   make -C tests clean
#
# The renderer (packages/max7219_clock_renderer.h) is deliberately free of
# ESPHome dependencies so the display state machine, layout, animation and OTA
# screens can be tested without hardware.

CXX ?= g++
CXXFLAGS ?= -std=c++17 -Wall -Wextra -Wno-unused-parameter -O2

.PHONY: all test fixture clean

all: test

test_renderer: test_renderer.cpp ../packages/max7219_clock_renderer.h
	$(CXX) $(CXXFLAGS) -o $@ test_renderer.cpp

renderer_fixture: renderer_fixture.cpp fonts.generated.h frame.generated.h string_ref.generated.h driver.generated.h ../packages/max7219_clock_renderer.h ../packages/max7219_clock_esphome.h
	$(CXX) $(CXXFLAGS) -o $@ renderer_fixture.cpp

fixture: renderer_fixture

test: test_renderer
	./test_renderer

clean:
	rm -f test_renderer renderer_fixture
