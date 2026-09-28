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

.PHONY: all test clean

all: test

test_renderer: test_renderer.cpp ../packages/max7219_clock_renderer.h
	$(CXX) $(CXXFLAGS) -o $@ test_renderer.cpp

test: test_renderer
	./test_renderer

clean:
	rm -f test_renderer
