const buildDateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC',
  timeZoneName: 'short',
});

export function formatBuildTimestamp(buildTimestamp?: string): string {
  if (!buildTimestamp) return '';

  const parsedDate = new Date(buildTimestamp);
  return Number.isNaN(parsedDate.getTime())
    ? buildTimestamp
    : buildDateTimeFormatter.format(parsedDate);
}

export function formatBuildDisplay(
  prefix: string,
  commitHash?: string,
  buildTimestamp?: string,
): string {
  if (!commitHash) return '';

  const formattedBuildTimestamp = formatBuildTimestamp(buildTimestamp);
  return formattedBuildTimestamp
    ? `${prefix}${commitHash} (built at ${formattedBuildTimestamp})`
    : `${prefix}${commitHash}`;
}
