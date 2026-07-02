/** @odoo-module **/

import { Component, onWillStart, onWillDestroy, useState } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";

export class KitchenOrderStatus extends Component {
    static template = "sm_kitchen_screen.Status";
    static props = ["*"];

    setup() {
        this.orm = useService("orm");
        this.busService = useService("bus_service");
        this.screenId = this.props.action.context.sm_screen_id;
        this.state = useState({ orders: [] });

        onWillStart(() => this.load());
        this.busService.addChannel("sm_kitchen_screen");
        this.busService.subscribe("SM_KITCHEN_UPDATE", () => this.scheduleLoad());
        onWillDestroy(() => clearTimeout(this.loadTimeout));
    }

    async load() {
        this.state.orders = await this.orm.call("sm.kitchen.screen", "sm_get_orders", [
            this.screenId,
        ]);
    }

    scheduleLoad() {
        clearTimeout(this.loadTimeout);
        this.loadTimeout = setTimeout(() => this.load(), 400);
    }

    byStage(stage) {
        return this.state.orders.filter((o) => o.stage === stage);
    }

    label(order) {
        return order.tracking_number || order.name;
    }
}

registry.category("actions").add("sm_kitchen_screen.status", KitchenOrderStatus);
