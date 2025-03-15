/**
 * Format milliseconds into a human-readable duration string (e.g., "1h 2m 3s")
 * @param ms Duration in milliseconds
 * @returns Formatted duration string
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));

  const parts: string[] = [];

  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

  return parts.join(" ");
}

/**
 * Display data in a table format without an index column
 * @param data Array of objects to display
 */
export function displayTable<T extends Record<string, any>>(data: T[]): void {
  if (data.length === 0) {
    console.log("No data to display");
    return;
  }

  // Get column names from the first object
  const columns = Object.keys(data[0]);

  // Calculate column widths based on content
  const columnWidths: Record<string, number> = {};

  // Initialize with header lengths
  columns.forEach((col) => {
    columnWidths[col] = col.length;
  });

  // Update with data lengths
  data.forEach((row) => {
    columns.forEach((col) => {
      const cellValue = String(row[col]);
      columnWidths[col] = Math.max(columnWidths[col], cellValue.length);
    });
  });

  // Create header row
  let headerRow = "│ ";
  columns.forEach((col) => {
    headerRow += col.padEnd(columnWidths[col]) + " │ ";
  });

  // Create separator line
  let separatorLine = "├─";
  columns.forEach((col) => {
    separatorLine += "─".repeat(columnWidths[col]) + "─┼─";
  });
  separatorLine = separatorLine.slice(0, -2) + "┤";

  // Create top border
  let topBorder = "┌─";
  columns.forEach((col) => {
    topBorder += "─".repeat(columnWidths[col]) + "─┬─";
  });
  topBorder = topBorder.slice(0, -2) + "┐";

  // Create bottom border
  let bottomBorder = "└─";
  columns.forEach((col) => {
    bottomBorder += "─".repeat(columnWidths[col]) + "─┴─";
  });
  bottomBorder = bottomBorder.slice(0, -2) + "┘";

  // Print the table
  console.log(topBorder);
  console.log(headerRow);
  console.log(separatorLine);

  // Print data rows
  data.forEach((row) => {
    let dataRow = "│ ";
    columns.forEach((col) => {
      dataRow += String(row[col]).padEnd(columnWidths[col]) + " │ ";
    });
    console.log(dataRow);
  });

  console.log(bottomBorder);
}
