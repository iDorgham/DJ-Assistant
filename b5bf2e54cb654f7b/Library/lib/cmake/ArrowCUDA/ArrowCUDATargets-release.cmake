#----------------------------------------------------------------
# Generated CMake target import file for configuration "Release".
#----------------------------------------------------------------

# Commands may need to know the format version.
set(CMAKE_IMPORT_FILE_VERSION 1)

# Import target "ArrowCUDA::arrow_cuda_shared" for configuration "Release"
set_property(TARGET ArrowCUDA::arrow_cuda_shared APPEND PROPERTY IMPORTED_CONFIGURATIONS RELEASE)
set_target_properties(ArrowCUDA::arrow_cuda_shared PROPERTIES
  IMPORTED_IMPLIB_RELEASE "${_IMPORT_PREFIX}/lib/arrow_cuda.lib"
  IMPORTED_LOCATION_RELEASE "${_IMPORT_PREFIX}/bin/arrow_cuda.dll"
  )

list(APPEND _cmake_import_check_targets ArrowCUDA::arrow_cuda_shared )
list(APPEND _cmake_import_check_files_for_ArrowCUDA::arrow_cuda_shared "${_IMPORT_PREFIX}/lib/arrow_cuda.lib" "${_IMPORT_PREFIX}/bin/arrow_cuda.dll" )

# Commands beyond this point should not need to know the version.
set(CMAKE_IMPORT_FILE_VERSION)
