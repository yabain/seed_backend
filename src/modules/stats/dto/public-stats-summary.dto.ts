export interface PublicStatsSummary {
  // Traffic stats (same as existing StatsSummary)
  totalPageViews: number;
  uniqueVisitors: number;
  todayPageViews: number;
  todayVisitors: number;

  // Content counts (active/published only)
  newsCount: number;
  resourcesCount: number;
  eventsCount: number;
  recruitmentsCount: number;
  programsCount: number;
  impactsCount: number;
  partnersCount: number;
  donationsCount: number;
  teamsCount: number;
}