export const ModuleLogger = (moduleName: string, message: string, isError = false) => {
  const d = new Date()
  const msg = `[${d.toLocaleString()}][${moduleName}]：${message}`
  if (isError) {
    console.error(msg)
  } else {
    console.log(msg)
  }
}
