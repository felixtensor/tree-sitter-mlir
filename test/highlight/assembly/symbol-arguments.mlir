module attributes {gpu.container_module} {
  func.func @launch_with_symbol_args(%sz : index) {
    gpu.launch blocks(%bx, %by, %bz) in (%grid_x = %sz, %grid_y = %sz, %grid_z = %sz)
               threads(%tx, %ty, %tz) in (%block_x = %sz, %block_y = %sz, %block_z = %sz)
               module(@test_module) function(@test_kernel_func) {
//             ^ keyword
//                    ^ string.special.symbol
//                                  ^ keyword
//                                           ^ string.special.symbol
      gpu.terminator
//    ^ function.builtin
    }
    return
//  ^ function.builtin
  }
}
