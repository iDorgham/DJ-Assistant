#----------------------------------------------------------------
# Generated CMake target import file for configuration "Release".
#----------------------------------------------------------------

# Commands may need to know the format version.
set(CMAKE_IMPORT_FILE_VERSION 1)

# Import target "ArrowFlight::arrow_flight_shared" for configuration "Release"
set_property(TARGET ArrowFlight::arrow_flight_shared APPEND PROPERTY IMPORTED_CONFIGURATIONS RELEASE)
set_target_properties(ArrowFlight::arrow_flight_shared PROPERTIES
  IMPORTED_IMPLIB_RELEASE "${_IMPORT_PREFIX}/lib/arrow_flight.lib"
  IMPORTED_LOCATION_RELEASE "${_IMPORT_PREFIX}/bin/arrow_flight.dll"
  )

list(APPEND _cmake_import_check_targets ArrowFlight::arrow_flight_shared )
list(APPEND _cmake_import_check_files_for_ArrowFlight::arrow_flight_shared "${_IMPORT_PREFIX}/lib/arrow_flight.lib" "${_IMPORT_PREFIX}/bin/arrow_flight.dll" )

# Commands beyond this point should not need to know the version.
set(CMAKE_IMPORT_FILE_VERSION)
