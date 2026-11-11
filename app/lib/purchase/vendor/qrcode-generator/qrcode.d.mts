/** 仅声明本项目使用的上游 MIT 模块接口；原始实现与许可证保存在同目录。 */
type Matrix = {
  addData(value: string, mode: "Byte"): void;
  make(): void;
  getModuleCount(): number;
  isDark(row: number, column: number): boolean;
};
declare const qrcode: (version: 0, correction: "M") => Matrix;
export default qrcode;
