#----------------------------------------------------------------
# Generated CMake target import file for configuration "Release".
#----------------------------------------------------------------

# Commands may need to know the format version.
set(CMAKE_IMPORT_FILE_VERSION 1)

# Import target "aws-cpp-sdk-sqs" for configuration "Release"
set_property(TARGET aws-cpp-sdk-sqs APPEND PROPERTY IMPORTED_CONFIGURATIONS RELEASE)
set_target_properties(aws-cpp-sdk-sqs PROPERTIES
  IMPORTED_IMPLIB_RELEASE "${_IMPORT_PREFIX}/bin/aws-cpp-sdk-sqs.lib"
  IMPORTED_LINK_DEPENDENT_LIBRARIES_RELEASE "aws-cpp-sdk-core"
  IMPORTED_LOCATION_RELEASE "${_IMPORT_PREFIX}/bin/aws-cpp-sdk-sqs.dll"
  )

list(APPEND _cmake_import_check_targets aws-cpp-sdk-sqs )
list(APPEND _cmake_import_check_files_for_aws-cpp-sdk-sqs "${_IMPORT_PREFIX}/bin/aws-cpp-sdk-sqs.lib" "${_IMPORT_PREFIX}/bin/aws-cpp-sdk-sqs.dll" )

# Commands beyond this point should not need to know the version.
set(CMAKE_IMPORT_FILE_VERSION)
