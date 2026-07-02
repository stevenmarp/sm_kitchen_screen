# -*- coding: utf-8 -*-
{
    "name": "Kitchen Screen",
    "version": "19.0.1.0.0",
    "category": "Point of Sale",
    "summary": "Realtime kitchen display for POS orders: cooking/ready/done stages, per-line ticking, order status screen for customers",
    "description": """
Kitchen Screen
==============

Realtime kitchen display system for Odoo Point of Sale.

* Define any number of kitchen screens (Main Kitchen, Bar, ...) linked to
  POS configurations and filtered by product categories
* Live updates over the Odoo bus: new POS orders appear instantly
* Cooking / Ready / Done stages with one-tap transitions
* Tick off individual order lines as they are prepared
* Timer per order, color coded by waiting time
* Customer-facing Order Status screen (Ready / Cooking numbers)
* Print a preparation ticket per order
    """,
    "author": "Steven Marp",
    "website": "https://apps.odoo.com/apps/modules/browse?author=Steven Marp",
    "license": "OPL-1",
    "depends": ["point_of_sale"],
    "data": [
        "security/ir.model.access.csv",
        "views/kitchen_screen_views.xml",
    ],
    "assets": {
        "web.assets_backend": [
            "sm_kitchen_screen/static/src/kitchen_screen/*",
            "sm_kitchen_screen/static/src/order_status/*",
        ],
    },
    "installable": True,
    "application": True,
    "auto_install": False,
    "price": 15.00,
    "currency": "USD",
}
