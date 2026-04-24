const SCOPED_ITEM_SEPARATOR = "::";

export function encodeScopedCloudItemId(accountId: string, remoteId: string): string {
  return `${encodeURIComponent(accountId)}${SCOPED_ITEM_SEPARATOR}${encodeURIComponent(remoteId)}`;
}

export function decodeScopedCloudItemId(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const separatorIndex = value.indexOf(SCOPED_ITEM_SEPARATOR);
  if (separatorIndex <= 0) {
    return null;
  }

  return {
    accountId: decodeURIComponent(value.slice(0, separatorIndex)),
    remoteId: decodeURIComponent(
      value.slice(separatorIndex + SCOPED_ITEM_SEPARATOR.length)
    ),
  };
}

export function getScopedCloudAccountId(value: string | null | undefined) {
  return decodeScopedCloudItemId(value)?.accountId ?? null;
}

export function getScopedCloudRemoteId(value: string | null | undefined) {
  const scopedValue = decodeScopedCloudItemId(value);
  if (scopedValue) {
    return scopedValue.remoteId;
  }
  return value ?? null;
}
