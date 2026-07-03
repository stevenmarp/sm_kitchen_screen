/** @odoo-module **/

import { Component, onWillStart, onWillDestroy, useState } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";

const STAGES = ["cooking", "ready", "done"];
const NEXT_STAGE = { cooking: "ready", ready: "done" };

export class KitchenScreen extends Component {
    static template = "sm_kitchen_screen.Screen";
    static props = ["*"];

    setup() {
        this.orm = useService("orm");
        this.busService = useService("bus_service");
        this.screenId = this.props.action.context.sm_screen_id;
        this.state = useState({
            stage: "cooking",
            orders: [],
            now: luxon.DateTime.now(),
            // ponytail: star lives in memory only; persist on pos.order if
            // highlights must survive a screen reload
            starred: {},
            sort: "newest",
            showOverview: false,
        });
        this.stages = STAGES;
        this.destroyed = false;
        this.previousOrderIds = new Set();

        onWillStart(() => this.load());

        this.busService.addChannel("sm_kitchen_screen");
        this.busService.subscribe("SM_KITCHEN_UPDATE", () => this.scheduleLoad());

        this.tick = setInterval(() => (this.state.now = luxon.DateTime.now()), 15000);
        onWillDestroy(() => {
            this.destroyed = true;
            clearInterval(this.tick);
            clearTimeout(this.loadTimeout);
        });
    }

    async load() {
        if (this.destroyed) return;
        this.state.orders = await this.orm.call("sm.kitchen.screen", "sm_get_orders", [
            this.screenId,
        ]);
        const newIds = new Set(this.state.orders.map((o) => o.id));
        const hasNewOrder = [...newIds].some((id) => !this.previousOrderIds.has(id));
        if (hasNewOrder && this.previousOrderIds.size > 0) {
            this.playSound();
        }
        this.previousOrderIds = newIds;
    }

    // bus fires on every pos.order write: debounce the refetch
    scheduleLoad() {
        clearTimeout(this.loadTimeout);
        this.loadTimeout = setTimeout(() => this.load(), 400);
    }

    get visibleOrders() {
        const orders = this.state.orders.filter((o) => o.stage === this.state.stage);
        // stars always first
        orders.sort((a, b) => (this.state.starred[b.id] ? 1 : 0) - (this.state.starred[a.id] ? 1 : 0));
        // then apply selected sort
        if (this.state.sort === "oldest") {
            orders.sort((a, b) => a.id - b.id);
        } else if (this.state.sort === "name") {
            orders.sort((a, b) => a.name.localeCompare(b.name));
        } else if (this.state.sort === "time") {
            orders.sort((a, b) => this.minutes(a) - this.minutes(b));
        }
        return orders;
    }

    get overview() {
        const cooking = this.state.orders.filter((o) => o.stage === "cooking");
        const dish = {};
        cooking.forEach((o) => {
            o.lines.forEach((l) => {
                dish[l.name] = (dish[l.name] || 0) + l.qty;
            });
        });
        return Object.entries(dish).sort((a, b) => b[1] - a[1]);
    }

    count(stage) {
        return this.state.orders.filter((o) => o.stage === stage).length;
    }

    minutes(order) {
        const dt = luxon.DateTime.fromSQL(order.date_order, { zone: "utc" });
        return Math.max(0, Math.floor(this.state.now.diff(dt, "minutes").minutes));
    }

    timerClass(order) {
        const m = this.minutes(order);
        if (m < 10) {
            return "sm-timer-fresh";
        }
        return m < 20 ? "sm-timer-warm" : "sm-timer-late";
    }

    async setStage(order, stage) {
        order.stage = stage; // optimistic
        await this.orm.call("pos.order", "sm_set_kitchen_stage", [[order.id], stage]);
    }

    nextStage(order) {
        return NEXT_STAGE[order.stage];
    }

    async toggleLine(line) {
        line.done = !line.done;
        await this.orm.write("pos.order.line", [line.id], { sm_kitchen_done: line.done });
    }

    toggleStar(order) {
        this.state.starred[order.id] = !this.state.starred[order.id];
    }

    printOrder(order) {
        const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
        const rows = order.lines
            .map((l) => {
                const notes = [l.note, l.customer_note]
                    .filter(Boolean)
                    .map((n) => `<div class="note">&#9656; ${esc(n)}</div>`)
                    .join("");
                return `<div class="line"><span class="qty">${esc(l.qty)}&times;</span><span class="item">${esc(l.name)}${notes}</span></div>`;
            })
            .join("");
        const now = luxon.DateTime.now().toFormat("dd/MM/yyyy HH:mm");
        const html = `
<style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: "Courier New", monospace; width: 280px; margin: 0 auto; padding: 12px 0; color: #000; }
    .center { text-align: center; }
    .shop { font-size: 13px; text-transform: uppercase; letter-spacing: 2px; }
    .number { font-size: 42px; font-weight: bold; line-height: 1.1; margin: 4px 0; }
    .meta { font-size: 12px; margin-bottom: 2px; }
    .rule { border-top: 1px dashed #000; margin: 10px 0; }
    .line { display: flex; gap: 8px; font-size: 15px; font-weight: bold; padding: 4px 0; }
    .qty { min-width: 34px; }
    .item { flex: 1; }
    .note { font-size: 12px; font-weight: normal; font-style: italic; margin-top: 1px; }
    .foot { font-size: 11px; margin-top: 4px; }
</style>
<div class="center">
    <div class="shop">${esc(order.config_name)}</div>
    <div class="number">${esc(order.tracking_number || order.name)}</div>
    ${order.table ? `<div class="meta">Table: ${esc(order.table)}</div>` : ""}
    ${order.partner ? `<div class="meta">${esc(order.partner.name)}</div>` : ""}
    <div class="meta">${esc(order.name)}</div>
</div>
<div class="rule"></div>
${rows}
${order.general_note ? `<div class="rule"></div><div class="note">&#9656; ${esc(order.general_note)}</div>` : ""}
<div class="rule"></div>
<div class="center foot">${now}</div>`;
        const w = window.open("", "_blank", "width=380,height=600");
        w.document.write(html);
        w.document.close();
        w.print();
        w.close();
    }

    playSound() {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 800;
        osc.type = "sine";
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.5);
    }

    exit() {
        window.history.back();
    }
}

registry.category("actions").add("sm_kitchen_screen.screen", KitchenScreen);
