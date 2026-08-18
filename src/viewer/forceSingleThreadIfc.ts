import { IfcAPI, type LocateFileHandlerFn } from "web-ifc";

const originalInit = IfcAPI.prototype.Init;

IfcAPI.prototype.Init = function (locateFileHandler?: LocateFileHandlerFn) {
  return originalInit.call(this, locateFileHandler, true);
};
