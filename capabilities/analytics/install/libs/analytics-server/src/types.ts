export type AnalyticsProperties = Record<
  string,
  string | number | boolean | null | undefined
>;

export type CaptureInput = {
  distinctId: string;
  event: string;
  properties?: AnalyticsProperties;
};

export type IdentifyInput = {
  distinctId: string;
  properties: AnalyticsProperties;
};
