#----------------------------------------------------------------
# Generated CMake target import file for configuration "Release".
#----------------------------------------------------------------

# Commands may need to know the format version.
set(CMAKE_IMPORT_FILE_VERSION 1)

# Import target "orc::orc" for configuration "Release"
set_property(TARGET orc::orc APPEND PROPERTY IMPORTED_CONFIGURATIONS RELEASE)
set_target_properties(orc::orc PROPERTIES
  IMPORTED_IMPLIB_RELEASE "${_IMPORT_PREFIX}/lib/orc.lib"
  IMPORTED_LOCATION_RELEASE "${_IMPORT_PREFIX}/bin/orc.dll"
  )

list(APPEND _cmake_import_check_targets orc::orc )
list(APPEND _cmake_import_check_files_for_orc::orc "${_IMPORT_PREFIX}/lib/orc.lib" "${_IMPORT_PREFIX}/bin/orc.dll" )

# Commands beyond this point should not need to know the version.
set(CMAKE_IMPORT_FILE_VERSION)
