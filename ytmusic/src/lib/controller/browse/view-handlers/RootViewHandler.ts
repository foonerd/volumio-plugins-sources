import ytmusic from '../../../YTMusicContext';
import { type BrowseEndpoint, EndpointType } from '../../../types/Endpoint';
import BaseViewHandler from './BaseViewHandler';
import { type GenericView } from './GenericViewHandler';
import type View from './View';
import { type RenderedPage } from './ViewHandler';
import ViewHelper from './ViewHelper';
import { type RenderedListItem } from './renderers/BaseRenderer';

const ROOT_ENDPOINTS = {
  HOME: 'FEmusic_home',
  EXPLORE: 'FEmusic_explore',
  LIBRARY: 'FEmusic_library_landing',
  HISTORY: 'FEmusic_history'
};

export interface RootView extends View {
  name: 'root';
}

export default class RootViewHandler extends BaseViewHandler<RootView> {

  browse(): Promise<RenderedPage> {
    const items: RenderedListItem[] = [
      {
        service: 'ytmusic',
        type: 'item-no-menu',
        title: ytmusic.getI18n('YTMUSIC_HOME'),
        uri: this.#constructUri(ROOT_ENDPOINTS.HOME),
        icon: 'fa fa-home'
      },
      {
        service: 'ytmusic',
        type: 'item-no-menu',
        title: ytmusic.getI18n('YTMUSIC_EXPLORE'),
        uri: this.#constructUri(ROOT_ENDPOINTS.EXPLORE),
        icon: 'fa fa-binoculars'
      },
      {
        service: 'ytmusic',
        type: 'item-no-menu',
        title: ytmusic.getI18n('YTMUSIC_LIBRARY'),
        uri: this.#constructUri(ROOT_ENDPOINTS.LIBRARY),
        icon: 'fa fa-bookmark'
      },
      {
        service: 'ytmusic',
        type: 'item-no-menu',
        title: ytmusic.getI18n('YTMUSIC_HISTORY'),
        uri: this.#constructUri(ROOT_ENDPOINTS.HISTORY),
        icon: 'fa fa-history'
      }
    ];

    return Promise.resolve({
      navigation: {
        prev: { uri: '/' },
        lists: [
          {
            title: 'YouTube Music',
            availableListViews: [ 'list', 'grid' ],
            items
          }
        ]
      }
    });
  }

  #constructUri(browseId: string): string {
    const endpoint: BrowseEndpoint = {
      type: EndpointType.Browse,
      payload: {
        browseId
      }
    };

    const targetView: GenericView = {
      name: 'generic',
      endpoint
    };

    return `ytmusic/${ViewHelper.constructUriSegmentFromView(targetView)}`;
  }
}
