/**
 * ViewSort.ts - 视图排序绑定组件
 * @description 该组件提供了视图排序的绑定功能，通过设置视图的排序索引来控制视图在不同层级的显示顺序，确保用户界面元素按照预期的层级关系进行渲染。
 * @see {@link https://vangagh.gitbook.io/brief-toolkit/uim/viewsort}
 * 
 * @author eathonq
 * @license MIT
 * @version v1.0.0
 * 
 * @created 2026-03-12
 * @modified 2026-03-22
 */

import { _decorator, Component, Enum, Node } from 'cc';
import { ViewSortIndex } from '../core/IViewManager';
const { ccclass, property, menu } = _decorator;

export const VIEW_SORT_TOOLTIP =
    "视图排序索引:\n" +
    "  ViewLow <\n" +
    "  View <\n" +
    "  ViewHigh <\n" +
    "  Menu <\n" +
    "  MessageBox <\n" +
    "  Tooltip <\n" +
    "  Top";

/** 视图排序绑定组件 */
@ccclass('uim.ViewSort')
@menu('BriefToolkit/UIM/ViewSort')
export class ViewSort extends Component {
  // 视图排序索引
  @property({
    type: Enum(ViewSortIndex),
    tooltip: VIEW_SORT_TOOLTIP,
  })
  sortIndex: ViewSortIndex = ViewSortIndex.View;
}
