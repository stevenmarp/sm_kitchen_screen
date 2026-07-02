# -*- coding: utf-8 -*-
from odoo import api, fields, models


class KitchenScreen(models.Model):
    _name = "sm.kitchen.screen"
    _description = "Kitchen Screen"

    name = fields.Char(required=True)
    pos_config_ids = fields.Many2many(
        "pos.config", string="Point of Sale",
        help="POS configurations feeding this screen. Empty = all.")
    pos_categ_ids = fields.Many2many(
        "pos.category", string="Product Categories",
        help="Only order lines of these categories are shown. Empty = all lines.")

    def action_open_screen(self):
        self.ensure_one()
        return {
            "type": "ir.actions.client",
            "tag": "sm_kitchen_screen.screen",
            "name": self.name,
            "context": {"sm_screen_id": self.id},
            "target": "fullscreen",
        }

    def action_open_status(self):
        self.ensure_one()
        return {
            "type": "ir.actions.client",
            "tag": "sm_kitchen_screen.status",
            "name": self.name,
            "context": {"sm_screen_id": self.id},
            "target": "fullscreen",
        }

    @api.model
    def sm_get_orders(self, screen_id):
        """Orders of open POS sessions for this screen, lines filtered by category."""
        screen = self.browse(screen_id)
        domain = [
            ("session_id.state", "=", "opened"),
            ("state", "!=", "cancel"),
        ]
        if screen.pos_config_ids:
            domain.append(("config_id", "in", screen.pos_config_ids.ids))
        orders = self.env["pos.order"].search(domain, order="date_order asc")
        categ_ids = set(screen.pos_categ_ids.ids)
        result = []
        for order in orders:
            lines = []
            for line in order.lines:
                if line.qty <= 0:
                    continue
                if categ_ids and not (categ_ids & set(line.product_id.pos_categ_ids.ids)):
                    continue
                lines.append({
                    "id": line.id,
                    "qty": line.qty,
                    "name": line.full_product_name or line.product_id.display_name,
                    "note": line.note or "",
                    "customer_note": line.customer_note or "",
                    "done": line.sm_kitchen_done,
                })
            if not lines:
                continue
            partner = order.partner_id
            result.append({
                "id": order.id,
                "name": order.pos_reference or order.name,
                "tracking_number": order.tracking_number or "",
                "date_order": fields.Datetime.to_string(order.date_order),
                "stage": order.sm_kitchen_stage or "cooking",
                "config_name": order.config_id.display_name,
                # pos_restaurant-only fields, present only when that module is installed
                "table": order.table_id.display_name if "table_id" in order._fields and order.table_id else "",
                "takeaway": bool(order.takeaway) if "takeaway" in order._fields else False,
                "floating_name": order.floating_order_name or "",
                "general_note": order.general_note or "",
                "partner": {
                    "name": partner.name,
                    "phone": partner.phone or "",
                    "email": partner.email or "",
                } if partner else None,
                "lines": lines,
            })
        return result
