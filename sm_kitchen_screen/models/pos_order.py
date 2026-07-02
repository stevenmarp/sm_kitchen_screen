# -*- coding: utf-8 -*-
from odoo import api, fields, models


class PosOrder(models.Model):
    _inherit = "pos.order"

    # ponytail: stage is per order, not per screen. If two screens must track
    # the same order independently, promote this to a screen/order join model.
    sm_kitchen_stage = fields.Selection(
        [("cooking", "Cooking"), ("ready", "Ready"), ("done", "Done")],
        string="Kitchen Stage", default="cooking", copy=False, index=True)

    def sm_set_kitchen_stage(self, stage):
        self.write({"sm_kitchen_stage": stage})
        return True

    @api.model_create_multi
    def create(self, vals_list):
        records = super().create(vals_list)
        records._sm_notify_kitchen()
        return records

    def write(self, vals):
        res = super().write(vals)
        self._sm_notify_kitchen()
        return res

    def _sm_notify_kitchen(self):
        if self:
            # one shared channel; screens debounce and refetch
            self.env["bus.bus"]._sendone("sm_kitchen_screen", "SM_KITCHEN_UPDATE", {})


class PosOrderLine(models.Model):
    _inherit = "pos.order.line"

    sm_kitchen_done = fields.Boolean(string="Prepared", copy=False)
