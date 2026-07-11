export interface XtreamCategory {
  category_id: string;
  category_name: string;
  parent_id: number;
}

export interface XtreamChannel {
  stream_id: number;
  name: string;
  stream_icon: string;
  num: number;
  epg_channel_id?: string;
  category_id: string;
}
