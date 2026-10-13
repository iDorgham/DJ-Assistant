#----------------------------------------------------------------
# Generated CMake target import file for configuration "Release".
#----------------------------------------------------------------

# Commands may need to know the format version.
set(CMAKE_IMPORT_FILE_VERSION 1)

# Import target "ArrowCompute::arrow_compute_shared" for configuration "Release"
set_property(TARGET ArrowCompute::arrow_compute_shared APPEND PROPERTY IMPORTED_CONFIGURATIONS RELEASE)
set_target_properties(ArrowCompute::arrow_compute_shared PROPERTIES
  IMPORTED_IMPLIB_RELEASE "${_IMPORT_PREFIX}/lib/arrow_compute.lib"
  IMPORTED_LINK_DEPENDENT_LIBRARIES_RELEASE "re2::re2"
  IMPORTED_LOCATION_RELEASE "${_IMPORT_PREFIX}/bin/arrow_compute.dll"
  )

list(APPEND _cmake_import_check_targets ArrowCompute::arrow_compute_shared )
list(APPEND _cmake_import_check_files_for_ArrowCompute::arrow_compute_shared "${_IMPORT_PREFIX}/lib/arrow_compute.lib" "${_IMPORT_PREFIX}/bin/arrow_compute.dll" )

# Commands beyond this point should not need to know the version.
set(CMAKE_IMPORT_FILE_VERSION)
