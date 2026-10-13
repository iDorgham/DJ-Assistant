#----------------------------------------------------------------
# Generated CMake target import file for configuration "Release".
#----------------------------------------------------------------

# Commands may need to know the format version.
set(CMAKE_IMPORT_FILE_VERSION 1)

# Import target "ArrowSubstrait::arrow_substrait_shared" for configuration "Release"
set_property(TARGET ArrowSubstrait::arrow_substrait_shared APPEND PROPERTY IMPORTED_CONFIGURATIONS RELEASE)
set_target_properties(ArrowSubstrait::arrow_substrait_shared PROPERTIES
  IMPORTED_IMPLIB_RELEASE "${_IMPORT_PREFIX}/lib/arrow_substrait.lib"
  IMPORTED_LOCATION_RELEASE "${_IMPORT_PREFIX}/bin/arrow_substrait.dll"
  )

list(APPEND _cmake_import_check_targets ArrowSubstrait::arrow_substrait_shared )
list(APPEND _cmake_import_check_files_for_ArrowSubstrait::arrow_substrait_shared "${_IMPORT_PREFIX}/lib/arrow_substrait.lib" "${_IMPORT_PREFIX}/bin/arrow_substrait.dll" )

# Commands beyond this point should not need to know the version.
set(CMAKE_IMPORT_FILE_VERSION)
