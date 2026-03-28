import { TCNetConfigurationError } from './errors.js';
import { TCNetNodeIdentity, TCNetNodeInfo } from './types.js';

export const differsByMoreThan = (a: number, b: number, diff: number) => {
  return Math.abs(a - b) > diff;
};

const MAX_NODE_NAME_LENGTH = 8;
const MAX_VENDOR_NAME_LENGTH = 16;
const MAX_APPLICATION_NAME_LENGTH = 16;

export type ProtocolStrings = {
  nodeName: Buffer;
  vendorName: Buffer;
  appName: Buffer;
};

export type AppInfo = {
  strings: ProtocolStrings;
  version: Buffer;
};

export const generateProtocolStrings = ({
  nodeName,
  vendorName,
  appName,
}: {
  nodeName: string;
  vendorName: string;
  appName: string;
}): ProtocolStrings => {
  const strings: ProtocolStrings = {
    nodeName: Buffer.from(
      nodeName.padEnd(MAX_NODE_NAME_LENGTH, '\x00'),
      'ascii',
    ),
    vendorName: Buffer.from(
      vendorName.padEnd(MAX_VENDOR_NAME_LENGTH, '\x00'),
      'ascii',
    ),
    appName: Buffer.from(
      appName.padEnd(MAX_APPLICATION_NAME_LENGTH, '\x00'),
      'ascii',
    ),
  };

  if (strings.nodeName.length > MAX_NODE_NAME_LENGTH) {
    throw new TCNetConfigurationError(
      `Node name "${nodeName}" exceeds maximum length of ${MAX_NODE_NAME_LENGTH} ASCII characters`,
    );
  }
  if (strings.vendorName.length > MAX_VENDOR_NAME_LENGTH) {
    throw new TCNetConfigurationError(
      `Vendor name "${vendorName}" exceeds maximum length of ${MAX_VENDOR_NAME_LENGTH} ASCII characters`,
    );
  }
  if (strings.appName.length > MAX_APPLICATION_NAME_LENGTH) {
    throw new TCNetConfigurationError(
      `Application name "${appName}" exceeds maximum length of ${MAX_APPLICATION_NAME_LENGTH} ASCII characters`,
    );
  }

  return strings;
};

export const generateApplicationVersion = (version: string) => {
  const [major, minor, bug] = version.split('.').map((part) => parseInt(part));
  if (
    major === undefined ||
    minor === undefined ||
    bug === undefined ||
    isNaN(major) ||
    isNaN(minor) ||
    isNaN(bug) ||
    major < 0 ||
    minor < 0 ||
    bug < 0 ||
    major > 255 ||
    minor > 255 ||
    bug > 255
  ) {
    throw new TCNetConfigurationError(
      `Invalid application version "${version}". Must be in format "major.minor.bug" with each part between 0 and 255.`,
    );
  }
  const buffer = Buffer.alloc(3);
  buffer.writeUInt8(major, 0);
  buffer.writeUInt8(minor, 1);
  buffer.writeUInt8(bug, 2);
  return buffer;
};

export const parseApplicationVersion = (buffer: Buffer) => {
  if (buffer.length !== 3) {
    throw new TCNetConfigurationError(
      `Invalid application version buffer length ${buffer.length}. Must be exactly 3 bytes.`,
    );
  }
  const major = buffer.readUInt8(0);
  const minor = buffer.readUInt8(1);
  const bug = buffer.readUInt8(2);
  return `${major}.${minor}.${bug}`;
};

export const getNodeDescription = (info: TCNetNodeInfo) => {
  return `${info.nodeName} (${info.appName} ${info.appVersion}) - ${info.host}:${info.nodeListenerPort} (${info.nodeType})`;
};

export const calculateUniqueNodeId = (info: TCNetNodeIdentity) => {
  return `${info.host}:${info.nodeId}`;
};
