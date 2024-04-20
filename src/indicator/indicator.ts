import Gio from '@gi-types/gio2';
import St from '@gi-types/st1';
import { registerGObjectClass } from '@/utils/gjs';
import { getCurrentExtension, logger } from '@/utils/shell';
import { Main, getMonitors, getScalingFactor } from '@/utils/ui';
import Settings from '@/settings';
import Layout from '@/components/layout/Layout';
import Tile from '@/components/layout/Tile';
import LayoutEditor from '@/components/editor/layoutEditor';
import DefaultMenu from './defaultMenu';
import GlobalState from '@/globalState';
import EditingMenu from './editingMenu';
import EditorDialog from '../components/editor/editorDialog';
import Shell from "@gi-types/shell0";

const PopupMenu = imports.ui.popupMenu;
const { Button: PopupMenuButton } = imports.ui.panelMenu;

const debug = logger('indicator');

enum IndicatorState {
    DEFAULT = 1,
    CREATE_NEW,
    EDITING_LAYOUT
}

@registerGObjectClass
export default class Indicator extends PopupMenuButton {
    private _layoutEditor: LayoutEditor | null = null;
    private _currentMenu: CurrentMenu;
    private _state: IndicatorState;

    constructor() {
        super(0.5, 'Modern Window Manager Indicator', false);
        const icon = new St.Icon({
            gicon: Gio.icon_new_for_string(`${getCurrentExtension().path}/icons/indicator.svg`),
            style_class: 'system-status-icon indicator-icon',
        });

        this.add_child(icon);
        this._state = IndicatorState.DEFAULT;
        
        this.connect('destroy', this._onDestroy.bind(this));
    }

    public enable() {
        this.menu.removeAll();
        this._currentMenu = new DefaultMenu(this);

        // todo
        /*Main.panel.statusArea.appMenu.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        const layouts = GlobalState.get().layouts;
        const rowsBoxLayout: St.BoxLayout[] = [];
        const layoutsPerRow = 2;
        for (let i = 0; i < layouts.length / layoutsPerRow; i++) {
            const item = new PopupMenu.PopupBaseMenuItem({ style_class: 'indicator-menu-item' });
            const box = new St.BoxLayout({
                x_align: Clutter.ActorAlign.CENTER,
                y_align: Clutter.ActorAlign.CENTER,
                x_expand: true,
                vertical: false, // horizontal box layout
                style_class: "layouts-box-layout",
            });
            rowsBoxLayout.push(box);
            item.add_actor(box);
            Main.panel.statusArea.appMenu.menu.addMenuItem(item);
        }
        const hasGaps = Settings.get_inner_gaps(1).top > 0;

        const layoutHeight: number = 36;
        const layoutWidth: number = 64; // 16:9 ratio. -> (16*layoutHeight) / 9 and then rounded to int
        const layoutsButtons: St.Widget[] = layouts.map((lay, ind) => {
            const btn = new St.Button({x_expand: false, style_class: "layout-button button"});
            btn.child = new LayoutSelectionWidget(lay, hasGaps ? 1:0, 1, layoutHeight, layoutWidth);
            rowsBoxLayout[Math.floor(ind / layoutsPerRow)].add_child(btn);
            return btn;
        });*/
    }

    public selectLayoutOnClick(layoutToSelect: Layout) {
        // change the layout of all the monitors
        Settings.save_selected_layouts_json(getMonitors().map((monitor) => layoutToSelect.id));
        this.menu.toggle();
    }

    public newLayoutOnClick(showLegend: boolean) {        
        this.menu.close();

        const newLayout = new Layout([
            new Tile({x: 0, y: 0, width: 0.30, height: 1, groups: [1]}),
            new Tile({x: 0.30, y: 0, width: 0.70, height: 1, groups: [1]}),
        ], `${Shell.Global.get().get_current_time()}`);

        if (this._layoutEditor) this._layoutEditor.layout = newLayout;
        else this._layoutEditor = new LayoutEditor(newLayout, Main.layoutManager.monitors[Main.layoutManager.primaryIndex]);
        this._setState(IndicatorState.CREATE_NEW);
        if (showLegend) this.openMenu(true);
    }

    public openMenu(legend: boolean) {
        const scalingFactor = getScalingFactor(Shell.Global.get().display.get_current_monitor());
        
        const dialog = new EditorDialog({
            scalingFactor,
            onNewLayout: () => {
                this.newLayoutOnClick(false);
            },
            onDeleteLayout: (ind: number, lay: Layout) => {
                GlobalState.get().deleteLayout(lay);
                
                if (this._layoutEditor && this._layoutEditor.layout.id === lay.id) {
                    this.cancelLayoutOnClick();
                }
            },
            onSelectLayout: (ind: number, lay: Layout) => {
                const layCopy = new Layout(lay.tiles.map(t => new Tile({x: t.x, y: t.y, width: t.width, height: t.height, groups: [...t.groups]})), lay.id);

                if (this._layoutEditor) this._layoutEditor.layout = layCopy;
                else this._layoutEditor = new LayoutEditor(layCopy, Main.layoutManager.monitors[Main.layoutManager.primaryIndex]);
                
                this._setState(IndicatorState.EDITING_LAYOUT);
            },
            legend
        });
        dialog.open(Shell.Global.get().get_current_time());
    }

    public editLayoutsOnClick() {        
        this.openMenu(false);
    }

    public saveLayoutOnClick() {
        if (this._layoutEditor === null || this._state === IndicatorState.DEFAULT) return;
        const newLayout = this._layoutEditor.layout;

        if (this._state === IndicatorState.CREATE_NEW) {
            GlobalState.get().addLayout(newLayout);
        } else {
            GlobalState.get().editLayout(newLayout);
        }

        this.menu.toggle();

        this._layoutEditor.destroy();
        this._layoutEditor = null;

        this._setState(IndicatorState.DEFAULT);
    }

    public cancelLayoutOnClick() {
        if (this._layoutEditor === null || this._state === IndicatorState.DEFAULT) return;

        this.menu.toggle();

        this._layoutEditor.destroy();
        this._layoutEditor = null;

        this._setState(IndicatorState.DEFAULT);
    }

    private _setState(newState: IndicatorState) {
        if (this._state === newState) return;
        this._state = newState;
        this._currentMenu.destroy();
        switch(newState) {
            case IndicatorState.DEFAULT:
                this._currentMenu = new DefaultMenu(this);
                break;
            case IndicatorState.CREATE_NEW:
            case IndicatorState.EDITING_LAYOUT:
                this._currentMenu = new EditingMenu(this);
                break;
        }
    }

    private _onDestroy() {
        this._layoutEditor?.destroy();
        this._layoutEditor = null;
        this._currentMenu.destroy();
    }
}
