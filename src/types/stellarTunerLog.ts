export interface StellarStation {
  id: string;
  name: string;
  channel_number: number;
  artist: string;
  title: string;
  album: string;
  cut_type: string;
  artwork_url: string;
  itunes_id: string;
}

export interface StellarNowPlayingResponse {
  updated_utc: string;
  poll_interval_seconds: number;
  station_count: number;
  stations: Record<string, StellarStation>;
}

export interface NowPlayingEntry {
  channelNumber: number;
  channelName: string;
  artist: string;
  title: string;
  album?: string;
  artworkUrl?: string;
  updatedAt: string;
}
