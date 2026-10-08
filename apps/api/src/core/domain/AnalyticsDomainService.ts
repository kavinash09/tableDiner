export class AnalyticsDomainService {
  /**
   * Calculates the logical "Business Date" string (YYYY-MM-DD)
   * based on the provided UTC date and the restaurant's cutoff hour.
   * 
   * Example: If cutoff is 4 AM, any time before 4 AM belongs to the previous calendar day.
   */
  public static calculateBusinessDate(utcDate: Date, cutoffHour: number): string {
    // For MVP, we are assuming the server runs in the tenant's local time 
    // or we just use UTC hours to demonstrate the logic.
    // In production, we'd use a timezone library like date-fns-tz or moment-timezone
    // to first convert utcDate to the Tenant's local time.
    
    const localDate = new Date(utcDate.getTime());
    const currentHour = localDate.getHours();
    
    if (currentHour < cutoffHour) {
      // It's past midnight but before cutoff -> roll back 1 day
      localDate.setDate(localDate.getDate() - 1);
    }
    
    // Format to YYYY-MM-DD
    const yyyy = localDate.getFullYear();
    const mm = String(localDate.getMonth() + 1).padStart(2, '0');
    const dd = String(localDate.getDate()).padStart(2, '0');
    
    return `${yyyy}-${mm}-${dd}`;
  }
}

