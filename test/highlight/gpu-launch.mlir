func.func @gpu_launch_symbols(%sz: index) {
  gpu.launch blocks(%bx, %by, %bz) in (%gx = %sz, %gy = %sz, %gz = %sz)
             threads(%tx, %ty, %tz) in (%txv = %sz, %tyv = %sz, %tzv = %sz)
             module(@test_module) function(@test_kernel_func) {
//           ^ keyword
//                  ^ string.special.symbol
//                                ^ keyword
//                                         ^ string.special.symbol
    gpu.terminator
//  ^ function.builtin
  }
}
