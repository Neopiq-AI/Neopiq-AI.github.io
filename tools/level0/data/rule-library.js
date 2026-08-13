/* GENERATED FILE — do not edit by hand.
 * Produced by tools/embed_assets.js from rules/*.json.
 * Embedded rather than fetched because Level 0 forbids network calls and a
 * file:// page cannot fetch its own siblings.
 */
(function (root) {
  'use strict';
  var L0 = (root.Level0 = root.Level0 || {});
  L0.bundledRules = [
    {
      "name": "d365_planning_l1_completeness.json",
      "payload": {
        "schema_version": "1.0",
        "module": "d365_planning_logic",
        "description": "Level 1 (completeness) rules for D365 planning master data. A missing planning parameter is not a cosmetic data-quality issue: MRP substitutes a default and produces a plan nobody intended.",
        "rules": [
          {
            "rule_id": "PLN_L1_MISSING_LEAD_TIME",
            "title": "Active purchased item without a purchase lead time",
            "level": "L1",
            "severity": "high",
            "detector": "detect_missing_fields",
            "entity": "items",
            "key_field": "item_id",
            "filter": {
              "op": "all",
              "conditions": [
                {
                  "op": "equals",
                  "field": "item_status",
                  "value": "Active"
                },
                {
                  "op": "equals",
                  "field": "production_type",
                  "value": "Purchased"
                }
              ]
            },
            "condition": {
              "op": "missing",
              "field": "lead_time_days"
            },
            "issue": "Active purchased item has no configured purchase lead time",
            "business_impact": "Master planning treats a blank lead time as zero, so planned purchase orders are created with a due date the supplier cannot meet. The shortage only becomes visible when the material is already late.",
            "likely_root_cause": "Item was released to the purchasing site without completing the default order settings, or the lead time lives only on the trade agreement.",
            "recommended_action": "Set the purchase lead time on the item default order settings (or confirm the vendor trade agreement lead time is used) before the next planning run.",
            "owner_field": "planner_id",
            "affected_objects": [
              {
                "label": "Item",
                "field": "item_id"
              }
            ],
            "source_references": [
              "D365_ReleasedProducts",
              "D365_DefaultOrderSettings"
            ],
            "tags": [
              "planning",
              "master_data",
              "lead_time"
            ]
          },
          {
            "rule_id": "PLN_L1_MISSING_SUPPLIER",
            "title": "Active purchased item without a primary vendor",
            "level": "L1",
            "severity": "high",
            "detector": "detect_missing_fields",
            "entity": "items",
            "key_field": "item_id",
            "filter": {
              "op": "all",
              "conditions": [
                {
                  "op": "equals",
                  "field": "item_status",
                  "value": "Active"
                },
                {
                  "op": "equals",
                  "field": "production_type",
                  "value": "Purchased"
                }
              ]
            },
            "condition": {
              "op": "missing",
              "field": "primary_vendor_id"
            },
            "issue": "Active purchased item has no primary vendor assigned",
            "business_impact": "Planned purchase orders cannot be firmed without manual vendor selection, so every replenishment for this item costs buyer time and the lead time actually applied is whatever that buyer happens to choose.",
            "likely_root_cause": "Sourcing was never transferred from the project/prototype phase into the item master, or the approved vendor list was maintained outside D365.",
            "recommended_action": "Assign the primary vendor on the item, or record the item as manually sourced so it is excluded from automatic planning.",
            "owner_field": "planner_id",
            "affected_objects": [
              {
                "label": "Item",
                "field": "item_id"
              }
            ],
            "source_references": [
              "D365_ReleasedProducts",
              "D365_ApprovedVendorList"
            ],
            "tags": [
              "planning",
              "sourcing"
            ]
          },
          {
            "rule_id": "PLN_L1_MISSING_COVERAGE_GROUP",
            "title": "Active item without a coverage group",
            "level": "L1",
            "severity": "medium",
            "detector": "detect_missing_fields",
            "entity": "items",
            "key_field": "item_id",
            "filter": {
              "op": "equals",
              "field": "item_status",
              "value": "Active"
            },
            "condition": {
              "op": "missing",
              "field": "coverage_group"
            },
            "issue": "Active item has no coverage group, so it inherits the site default planning policy",
            "business_impact": "The item is planned by whatever the default coverage code happens to be. Coverage period, safety stock behaviour and lot sizing are then accidental rather than chosen, which is a common source of both excess stock and shortages.",
            "likely_root_cause": "Item coverage record was never created for this item/site combination.",
            "recommended_action": "Assign the coverage group that matches the item's demand pattern, or confirm explicitly that the site default is intended.",
            "owner_field": "planner_id",
            "affected_objects": [
              {
                "label": "Item",
                "field": "item_id"
              }
            ],
            "source_references": [
              "D365_ItemCoverage"
            ],
            "tags": [
              "planning",
              "coverage_group"
            ]
          },
          {
            "rule_id": "PLN_L1_MISSING_PLANNER",
            "title": "Active item with no planner, or a planner who does not exist",
            "level": "L1",
            "severity": "medium",
            "detector": "detect_owner_gap",
            "entity": "items",
            "key_field": "item_id",
            "filter": {
              "op": "equals",
              "field": "item_status",
              "value": "Active"
            },
            "spec": {
              "owner_field": "planner_id",
              "reference": {
                "dataset": "planners",
                "key_field": "planner_id"
              }
            },
            "issue": "Active item has no accountable planner, or references a planner who is not in the planner master",
            "business_impact": "Exception messages, action messages and every recommendation in this report have no addressee. Unowned items are the ones whose parameters silently rot, because nobody is measured on them.",
            "likely_root_cause": "Planner left the company and the item was never reassigned, or the planner field was never maintained for this product group.",
            "recommended_action": "Assign a current planner to the item; if the planner code is obsolete, remap it as part of the next master-data cleanup.",
            "owner_field": "planner_id",
            "affected_objects": [
              {
                "label": "Item",
                "field": "item_id"
              }
            ],
            "source_references": [
              "D365_ReleasedProducts",
              "D365_Planners"
            ],
            "tags": [
              "ownership",
              "governance"
            ]
          },
          {
            "rule_id": "PLN_L1_MISSING_ITEM_GROUP",
            "title": "Active item with no item group (product family)",
            "level": "L1",
            "severity": "medium",
            "detector": "detect_missing_fields",
            "entity": "items",
            "key_field": "item_id",
            "filter": {
              "op": "equals",
              "field": "item_status",
              "value": "Active"
            },
            "condition": {
              "op": "missing",
              "field": "item_group"
            },
            "issue": "Active item does not belong to any item group, so it has no product family",
            "business_impact": "The item is invisible to every analysis and policy that works by family: ABC segmentation, coverage policy by group, demand review, inventory targets and the peer comparisons this diagnostic itself performs. It also usually means the item bypassed the release process, so other defaults are likely missing too.",
            "likely_root_cause": "Item was created directly rather than through the product release workflow, or migrated from a legacy system whose group codes were never mapped.",
            "recommended_action": "Assign the item group that matches the item's role, and check the rest of that item's planning defaults at the same time - an item that escaped the release process rarely has only one field missing.",
            "owner_field": "planner_id",
            "affected_objects": [
              {
                "label": "Item",
                "field": "item_id"
              }
            ],
            "source_references": [
              "D365_ReleasedProducts",
              "D365_ItemGroups"
            ],
            "tags": [
              "planning",
              "master_data",
              "product_family"
            ]
          },
          {
            "rule_id": "PLN_L1_MISSING_SITE",
            "title": "Active item with no planning site",
            "level": "L1",
            "severity": "medium",
            "detector": "detect_missing_fields",
            "entity": "items",
            "key_field": "item_id",
            "filter": {
              "op": "equals",
              "field": "item_status",
              "value": "Active"
            },
            "condition": {
              "op": "missing",
              "field": "site_id"
            },
            "issue": "Active item has no site, so master planning has no dimension to plan it on",
            "business_impact": "Requirements for this item cannot be netted against supply at a location. Depending on the storage dimension setup, master planning either ignores the item or plans it in a dimension nobody looks at, so its shortages are discovered by the shop floor rather than by the plan.",
            "likely_root_cause": "Default order settings or the site-specific item record were never created after the item was released to the legal entity.",
            "recommended_action": "Create the item's site-level default order settings for every site that plans or stocks it, before the next master planning run.",
            "owner_field": "planner_id",
            "affected_objects": [
              {
                "label": "Item",
                "field": "item_id"
              }
            ],
            "source_references": [
              "D365_ReleasedProducts",
              "D365_DefaultOrderSettings"
            ],
            "tags": [
              "planning",
              "master_data",
              "site"
            ]
          }
        ]
      }
    },
    {
      "name": "d365_planning_l2_consistency.json",
      "payload": {
        "schema_version": "1.0",
        "module": "d365_planning_logic",
        "description": "Level 2 (consistency) rules. Each field is individually populated and plausible; the combination is not. These are the findings a field-by-field data quality tool cannot produce.",
        "rules": [
          {
            "rule_id": "PLN_L2_PURCHASED_WITH_ROUTE",
            "title": "Purchased item that still carries a production route",
            "level": "L2",
            "severity": "medium",
            "detector": "detect_cross_table_conflict",
            "entity": "items",
            "key_field": "item_id",
            "filter": {
              "op": "all",
              "conditions": [
                {
                  "op": "equals",
                  "field": "item_status",
                  "value": "Active"
                },
                {
                  "op": "equals",
                  "field": "production_type",
                  "value": "Purchased"
                }
              ]
            },
            "spec": {
              "related": {
                "dataset": "production_routes",
                "key_field": "item_id",
                "alias": "route"
              }
            },
            "condition": {
              "op": "gte",
              "field": "computed.match_count",
              "value": 1
            },
            "issue": "Item is configured as purchased but still has an active production route",
            "business_impact": "Planning may propose production orders for an item nobody manufactures any more, or the costing roll-up uses route capacity that does not exist. Both distort capacity load and standard cost.",
            "likely_root_cause": "Item was moved from in-house manufacturing to external purchasing and the route was never deactivated.",
            "recommended_action": "Deactivate or delete the production route, or correct the production type if the item is genuinely still manufactured.",
            "owner_field": "planner_id",
            "affected_objects": [
              {
                "label": "Item",
                "field": "item_id"
              }
            ],
            "source_references": [
              "D365_ReleasedProducts",
              "D365_Routes"
            ],
            "tags": [
              "consistency",
              "make_or_buy"
            ]
          },
          {
            "rule_id": "PLN_L2_OBSOLETE_STILL_FORECASTED",
            "title": "Obsolete item that is still carrying demand forecast",
            "level": "L2",
            "severity": "medium",
            "detector": "detect_cross_table_conflict",
            "entity": "items",
            "key_field": "item_id",
            "filter": {
              "op": "equals",
              "field": "item_status",
              "value": "Obsolete"
            },
            "spec": {
              "related": {
                "dataset": "forecast_lines",
                "key_field": "item_id",
                "alias": "forecast",
                "value_field": "forecast_qty"
              }
            },
            "condition": {
              "op": "all",
              "conditions": [
                {
                  "op": "gte",
                  "field": "computed.match_count",
                  "value": 1
                },
                {
                  "op": "gt",
                  "field": "computed.match_sum",
                  "value": 0
                }
              ]
            },
            "issue": "Item is flagged obsolete but demand forecast lines still exist for it",
            "business_impact": "Master planning keeps generating supply for a product that is no longer sold, which turns directly into excess and eventually into write-off. It also inflates the forecast accuracy denominator and hides real demand signal.",
            "likely_root_cause": "Item lifecycle status was changed without cleaning up the demand plan, or the forecast is maintained in a separate planning tool that was not informed.",
            "recommended_action": "Remove or zero the remaining forecast lines, and add a lifecycle-state check to the forecast upload interface.",
            "owner_field": "planner_id",
            "affected_objects": [
              {
                "label": "Item",
                "field": "item_id"
              }
            ],
            "source_references": [
              "D365_ReleasedProducts",
              "D365_DemandForecast"
            ],
            "tags": [
              "consistency",
              "lifecycle",
              "forecast"
            ]
          },
          {
            "rule_id": "PLN_L2_VENDOR_LEADTIME_CONFLICT",
            "title": "Item lead time disagrees with the vendor's standard lead time",
            "level": "L2",
            "severity": "medium",
            "detector": "detect_cross_table_conflict",
            "entity": "items",
            "key_field": "item_id",
            "filter": {
              "op": "all",
              "conditions": [
                {
                  "op": "equals",
                  "field": "item_status",
                  "value": "Active"
                },
                {
                  "op": "equals",
                  "field": "production_type",
                  "value": "Purchased"
                }
              ]
            },
            "spec": {
              "related": {
                "dataset": "vendors",
                "key_field": "vendor_id",
                "local_field": "primary_vendor_id",
                "alias": "vendor"
              }
            },
            "condition": {
              "op": "all",
              "conditions": [
                {
                  "op": "gte",
                  "field": "computed.match_count",
                  "value": 1
                },
                {
                  "op": "abs_diff_gte",
                  "field": "vendor.standard_lead_time_days",
                  "other_field": "lead_time_days",
                  "value": 10
                }
              ]
            },
            "issue": "Configured item lead time differs materially from the primary vendor's standard lead time",
            "business_impact": "Two systems of record disagree about the same supply promise. Whichever one planning uses, buyers will be expediting against a date the other side never agreed to.",
            "likely_root_cause": "Vendor master was updated after a sourcing change while the item default order settings kept the old assumption (or vice versa).",
            "recommended_action": "Decide which value is authoritative for this item/vendor combination, align the other, and confirm against recent receipt performance before changing the planning parameter.",
            "owner_field": "planner_id",
            "affected_objects": [
              {
                "label": "Item",
                "field": "item_id"
              },
              {
                "label": "Vendor",
                "field": "vendor.vendor_id"
              }
            ],
            "source_references": [
              "D365_ReleasedProducts",
              "D365_VendorMaster"
            ],
            "tags": [
              "consistency",
              "lead_time",
              "sourcing"
            ]
          },
          {
            "rule_id": "PLN_L2_UNKNOWN_COVERAGE_GROUP",
            "title": "Item points at a coverage group that does not exist",
            "level": "L2",
            "severity": "medium",
            "detector": "detect_cross_table_conflict",
            "entity": "items",
            "key_field": "item_id",
            "filter": {
              "op": "all",
              "conditions": [
                {
                  "op": "equals",
                  "field": "item_status",
                  "value": "Active"
                },
                {
                  "op": "present",
                  "field": "coverage_group"
                }
              ]
            },
            "spec": {
              "related": {
                "dataset": "coverage_groups",
                "key_field": "coverage_group",
                "local_field": "coverage_group",
                "alias": "coverage"
              }
            },
            "condition": {
              "op": "lt",
              "field": "computed.match_count",
              "value": 1
            },
            "issue": "Item references a coverage group that is not defined in the coverage group master",
            "business_impact": "The planning policy the item claims to follow does not exist, so behaviour depends on the fallback the system applies. Any analysis grouped by coverage group also silently loses this item.",
            "likely_root_cause": "Coverage group was renamed or deleted, or the item was imported from a legacy system with unmapped codes.",
            "recommended_action": "Remap the item to a valid coverage group, and add the coverage group to the data-migration mapping table so the import stops reintroducing it.",
            "owner_field": "planner_id",
            "affected_objects": [
              {
                "label": "Item",
                "field": "item_id"
              }
            ],
            "source_references": [
              "D365_ItemCoverage",
              "D365_CoverageGroups"
            ],
            "tags": [
              "consistency",
              "referential_integrity"
            ]
          },
          {
            "rule_id": "PLN_L2_UNKNOWN_REDUCTION_KEY",
            "title": "Item points at a forecast reduction key that does not exist",
            "level": "L2",
            "severity": "medium",
            "detector": "detect_cross_table_conflict",
            "entity": "items",
            "key_field": "item_id",
            "filter": {
              "op": "all",
              "conditions": [
                {
                  "op": "equals",
                  "field": "item_status",
                  "value": "Active"
                },
                {
                  "op": "present",
                  "field": "reduction_key"
                }
              ]
            },
            "spec": {
              "related": {
                "dataset": "reduction_keys",
                "key_field": "reduction_key",
                "local_field": "reduction_key",
                "alias": "reduction"
              }
            },
            "condition": {
              "op": "lt",
              "field": "computed.match_count",
              "value": 1
            },
            "issue": "Item references a forecast reduction key that is not defined in the reduction key master",
            "business_impact": "The reduction principle the item claims to follow does not exist, so forecast consumption falls back to whatever the system default is. Forecast is then reduced on a period the business never agreed, which shows up as demand appearing twice near the horizon boundary or disappearing too early.",
            "likely_root_cause": "Reduction key was renamed or deleted, or the item was imported from a legacy system whose codes were never mapped.",
            "recommended_action": "Remap the item to a valid reduction key, and add the obsolete code to the migration mapping table so imports stop reintroducing it.",
            "owner_field": "planner_id",
            "affected_objects": [
              {
                "label": "Item",
                "field": "item_id"
              }
            ],
            "source_references": [
              "D365_ItemCoverage",
              "D365_ForecastReductionKeys"
            ],
            "tags": [
              "consistency",
              "referential_integrity",
              "reduction_key",
              "forecast"
            ]
          },
          {
            "rule_id": "PLN_L2_FORECAST_WITHOUT_REDUCTION_KEY",
            "title": "Item carries demand forecast but no forecast reduction key",
            "level": "L2",
            "severity": "high",
            "detector": "detect_cross_table_conflict",
            "entity": "items",
            "key_field": "item_id",
            "filter": {
              "op": "all",
              "conditions": [
                {
                  "op": "equals",
                  "field": "item_status",
                  "value": "Active"
                },
                {
                  "op": "missing",
                  "field": "reduction_key"
                }
              ]
            },
            "spec": {
              "related": {
                "dataset": "forecast_lines",
                "key_field": "item_id",
                "alias": "forecast",
                "value_field": "forecast_qty"
              }
            },
            "condition": {
              "op": "all",
              "conditions": [
                {
                  "op": "gte",
                  "field": "computed.match_count",
                  "value": 1
                },
                {
                  "op": "gt",
                  "field": "computed.match_sum",
                  "value": 0
                }
              ]
            },
            "issue": "Item has an active demand forecast but no reduction key, so incoming sales orders never consume the forecast",
            "business_impact": "Forecast and actual orders are both counted as demand for the same period, so master planning sees roughly double the real requirement. The result is systematic over-supply on exactly the items the business forecasts most carefully, and it looks like a forecast accuracy problem rather than a configuration one.",
            "likely_root_cause": "Forecast was loaded from a separate planning tool or spreadsheet, and the item coverage record that carries the reduction key was never completed.",
            "recommended_action": "Set the reduction key that matches the agreed consumption principle, then re-run master planning and compare the planned order volume before and after to quantify the over-supply that had been generated.",
            "owner_field": "planner_id",
            "affected_objects": [
              {
                "label": "Item",
                "field": "item_id"
              }
            ],
            "source_references": [
              "D365_ItemCoverage",
              "D365_DemandForecast"
            ],
            "tags": [
              "consistency",
              "forecast",
              "reduction_key"
            ]
          },
          {
            "rule_id": "PLN_L2_MANUFACTURED_WITHOUT_ROUTE",
            "title": "Manufactured item with no production route",
            "level": "L2",
            "severity": "medium",
            "detector": "detect_cross_table_conflict",
            "entity": "items",
            "key_field": "item_id",
            "filter": {
              "op": "all",
              "conditions": [
                {
                  "op": "equals",
                  "field": "item_status",
                  "value": "Active"
                },
                {
                  "op": "equals",
                  "field": "production_type",
                  "value": "Manufactured"
                }
              ]
            },
            "spec": {
              "related": {
                "dataset": "production_routes",
                "key_field": "item_id",
                "alias": "route"
              }
            },
            "condition": {
              "op": "lt",
              "field": "computed.match_count",
              "value": 1
            },
            "issue": "Item is configured as manufactured but has no production route",
            "business_impact": "Master planning can propose a production order it cannot schedule, and the item consumes no capacity in the plan. Capacity utilisation therefore looks lower than it is, and the cost roll-up carries no operation cost for the item, which understates its standard cost.",
            "likely_root_cause": "Route was never created for the item, or the production type was set to manufactured for costing reasons while the item is really purchased or phantom.",
            "recommended_action": "Create the route (and confirm the BOM exists), or correct the production type if the item is not actually manufactured in-house.",
            "owner_field": "planner_id",
            "affected_objects": [
              {
                "label": "Item",
                "field": "item_id"
              }
            ],
            "source_references": [
              "D365_ReleasedProducts",
              "D365_Routes"
            ],
            "tags": [
              "consistency",
              "make_or_buy",
              "production"
            ]
          },
          {
            "rule_id": "PLN_L2_OBSOLETE_WITH_ON_HAND",
            "title": "Obsolete item that still holds physical inventory",
            "level": "L2",
            "severity": "medium",
            "detector": "detect_cross_table_conflict",
            "entity": "items",
            "key_field": "item_id",
            "filter": {
              "op": "equals",
              "field": "item_status",
              "value": "Obsolete"
            },
            "spec": {
              "related": {
                "dataset": "inventory_on_hand",
                "key_field": "item_id",
                "alias": "stock",
                "value_field": "on_hand_qty"
              }
            },
            "condition": {
              "op": "all",
              "conditions": [
                {
                  "op": "gte",
                  "field": "computed.match_count",
                  "value": 1
                },
                {
                  "op": "gt",
                  "field": "computed.match_sum",
                  "value": 0
                }
              ]
            },
            "issue": "Item is flagged obsolete but physical stock is still on hand",
            "business_impact": "This inventory has no demand path left: it will not be consumed by orders, and no planning policy will drain it. It sits as capital and warehouse space until someone writes it off, and the longer that decision waits the more likely it is taken as a surprise at year end.",
            "likely_root_cause": "Lifecycle status was changed when the product was discontinued, without a corresponding decision about what to do with the remaining stock.",
            "recommended_action": "Decide the disposition explicitly - scrap, sell down, or return to active for a defined service period - and record the value at risk so the write-off is a planned number rather than a discovered one.",
            "owner_field": "planner_id",
            "affected_objects": [
              {
                "label": "Item",
                "field": "item_id"
              }
            ],
            "source_references": [
              "D365_ReleasedProducts",
              "D365_InventoryOnHand"
            ],
            "tags": [
              "consistency",
              "lifecycle",
              "inventory"
            ]
          }
        ]
      }
    },
    {
      "name": "d365_planning_l3_rationality.json",
      "payload": {
        "schema_version": "1.0",
        "module": "d365_planning_logic",
        "description": "Level 3 (rationality / reality gap) rules. These compare the configured world against the observed world: what the system assumes versus what actually happened. This is the layer that answers 'why does the plan behave wrongly', not 'which field is blank'.",
        "rules": [
          {
            "rule_id": "PLN_L3_LEADTIME_GAP_NO_BUFFER",
            "title": "Actual receipt lead time far exceeds the configured lead time, with zero safety stock",
            "level": "L3",
            "severity": "high",
            "detector": "detect_historical_behavior_gap",
            "entity": "items",
            "key_field": "item_id",
            "spec": {
              "observation": {
                "dataset": "purchase_receipts",
                "key_field": "item_id",
                "metric": "mean",
                "days_between": [
                  "order_date",
                  "actual_receipt_date"
                ],
                "min_samples": 3
              }
            },
            "filter": {
              "op": "all",
              "conditions": [
                {
                  "op": "equals",
                  "field": "item_status",
                  "value": "Active"
                },
                {
                  "op": "equals",
                  "field": "production_type",
                  "value": "Purchased"
                }
              ]
            },
            "condition": {
              "op": "all",
              "conditions": [
                {
                  "op": "ratio_gte",
                  "field": "computed.observed",
                  "other_field": "lead_time_days",
                  "value": 1.4
                },
                {
                  "op": "abs_diff_gte",
                  "field": "computed.observed",
                  "other_field": "lead_time_days",
                  "value": 10
                },
                {
                  "op": "lte",
                  "field": "safety_stock_qty",
                  "value": 0
                }
              ]
            },
            "issue": "Configured lead time is materially shorter than actual receipt behaviour and there is no safety stock to absorb the difference",
            "business_impact": "Planning logic structurally underestimates replenishment risk: MRP proposes supply too late by design, and with zero safety stock there is nothing between the gap and the customer. Expect recurring shortages, expediting cost and service failures that look like supplier problems but originate in configuration.",
            "likely_root_cause": "Outdated item or vendor lead time assumption that was never recalibrated against receipt history after a sourcing or volume change.",
            "recommended_action": "Reset the item lead time towards observed receipt behaviour, and add a temporary buffer (safety stock or safety margin) until supplier performance is confirmed to be stable.",
            "owner_field": "planner_id",
            "affected_objects": [
              {
                "label": "Item",
                "field": "item_id"
              },
              {
                "label": "Vendor",
                "field": "primary_vendor_id"
              }
            ],
            "source_references": [
              "D365_DefaultOrderSettings",
              "D365_PurchaseReceiptHistory"
            ],
            "tags": [
              "rationality",
              "lead_time",
              "reality_gap"
            ]
          },
          {
            "rule_id": "PLN_L3_LEADTIME_GAP",
            "title": "Actual receipt lead time exceeds the configured lead time",
            "level": "L3",
            "severity": "medium",
            "detector": "detect_historical_behavior_gap",
            "entity": "items",
            "key_field": "item_id",
            "spec": {
              "observation": {
                "dataset": "purchase_receipts",
                "key_field": "item_id",
                "metric": "mean",
                "days_between": [
                  "order_date",
                  "actual_receipt_date"
                ],
                "min_samples": 3
              }
            },
            "filter": {
              "op": "all",
              "conditions": [
                {
                  "op": "equals",
                  "field": "item_status",
                  "value": "Active"
                },
                {
                  "op": "equals",
                  "field": "production_type",
                  "value": "Purchased"
                },
                {
                  "op": "gt",
                  "field": "safety_stock_qty",
                  "value": 0
                }
              ]
            },
            "condition": {
              "op": "all",
              "conditions": [
                {
                  "op": "ratio_gte",
                  "field": "computed.observed",
                  "other_field": "lead_time_days",
                  "value": 1.4
                },
                {
                  "op": "abs_diff_gte",
                  "field": "computed.observed",
                  "other_field": "lead_time_days",
                  "value": 10
                }
              ]
            },
            "issue": "Configured lead time is materially shorter than actual receipt behaviour",
            "business_impact": "Planned orders are released too late relative to how the supplier really performs. Existing safety stock absorbs part of the error, so the symptom appears as chronic stock erosion and repeated manual expediting rather than as an outright stock-out.",
            "likely_root_cause": "Lead time was set at implementation time and never recalibrated against receipt history.",
            "recommended_action": "Review the item and vendor lead time against the receipt history, and agree a realistic value with the buyer before the next planning cycle.",
            "owner_field": "planner_id",
            "affected_objects": [
              {
                "label": "Item",
                "field": "item_id"
              },
              {
                "label": "Vendor",
                "field": "primary_vendor_id"
              }
            ],
            "source_references": [
              "D365_DefaultOrderSettings",
              "D365_PurchaseReceiptHistory"
            ],
            "tags": [
              "rationality",
              "lead_time",
              "reality_gap"
            ]
          },
          {
            "rule_id": "PLN_L3_LEADTIME_OUTLIER",
            "title": "Lead time far outside the range of comparable items",
            "level": "L3",
            "severity": "medium",
            "detector": "detect_outlier_parameter",
            "entity": "items",
            "key_field": "item_id",
            "filter": {
              "op": "all",
              "conditions": [
                {
                  "op": "equals",
                  "field": "item_status",
                  "value": "Active"
                },
                {
                  "op": "equals",
                  "field": "production_type",
                  "value": "Purchased"
                }
              ]
            },
            "spec": {
              "field": "lead_time_days",
              "group_by": "item_group",
              "min_group_size": 5
            },
            "condition": {
              "op": "outlier",
              "field": "lead_time_days",
              "value": 3.5,
              "direction": "high"
            },
            "issue": "Configured lead time is an extreme outlier compared with other items in the same item group",
            "business_impact": "An extreme lead time drags planned order release far into the past, inflates pipeline inventory and dominates any lead-time based safety stock calculation. When the value is a typo rather than reality, it quietly distorts the whole group's plan.",
            "likely_root_cause": "Data entry error (wrong unit, for example weeks entered as days) or a one-off sourcing situation that was never reverted.",
            "recommended_action": "Confirm with the buyer whether the lead time is genuine; if it is, document why, and if it is not, correct it and check whether the same error exists on sibling items.",
            "owner_field": "planner_id",
            "affected_objects": [
              {
                "label": "Item",
                "field": "item_id"
              }
            ],
            "source_references": [
              "D365_DefaultOrderSettings"
            ],
            "tags": [
              "rationality",
              "outlier",
              "lead_time"
            ]
          },
          {
            "rule_id": "PLN_L3_SAFETY_STOCK_VS_VOLATILITY",
            "title": "Safety stock is far below what observed demand volatility requires",
            "level": "L3",
            "severity": "high",
            "detector": "detect_historical_behavior_gap",
            "entity": "items",
            "key_field": "item_id",
            "spec": {
              "observation": {
                "dataset": "sales_order_lines",
                "key_field": "item_id",
                "metric": "stdev_by_period",
                "value_field": "qty",
                "period_field": "order_date",
                "period": "month",
                "min_samples": 6
              },
              "derived": [
                {
                  "name": "required_safety_stock",
                  "formula": "normal_service_buffer",
                  "params": {
                    "sigma_source": "observed",
                    "lead_time_field": "lead_time_days",
                    "period_days": 30,
                    "service_z": 1.64
                  }
                }
              ]
            },
            "filter": {
              "op": "all",
              "conditions": [
                {
                  "op": "equals",
                  "field": "item_status",
                  "value": "Active"
                },
                {
                  "op": "equals",
                  "field": "production_type",
                  "value": "Purchased"
                }
              ]
            },
            "condition": {
              "op": "all",
              "conditions": [
                {
                  "op": "field_lt",
                  "field": "safety_stock_qty",
                  "other_field": "computed.required_safety_stock"
                },
                {
                  "op": "abs_diff_gte",
                  "field": "computed.required_safety_stock",
                  "other_field": "safety_stock_qty",
                  "value": 20
                }
              ]
            },
            "issue": "Configured safety stock is far below the buffer that observed demand volatility and lead time would require for a 95% service level",
            "business_impact": "Demand for this item is lumpy, so the average is a poor guide. With this buffer the item will be available in quiet months and short exactly in the peaks, which is when the shortage costs the most.",
            "likely_root_cause": "Safety stock was set once as a round number (or inherited from the coverage group) rather than derived from demand variability and replenishment time.",
            "recommended_action": "Recalculate safety stock from demand variability and lead time for the agreed service level, or move the item to a min/max coverage policy that is reviewed periodically.",
            "owner_field": "planner_id",
            "affected_objects": [
              {
                "label": "Item",
                "field": "item_id"
              }
            ],
            "source_references": [
              "D365_ItemCoverage",
              "D365_SalesOrderHistory"
            ],
            "tags": [
              "rationality",
              "safety_stock",
              "service_level"
            ]
          },
          {
            "rule_id": "PLN_L3_DELIVERY_PERFORMANCE_DECAY",
            "title": "On-time shipment performance has degraded over the observed horizon",
            "level": "L3",
            "severity": "medium",
            "detector": "detect_kpi_degradation_pattern",
            "entity": "items",
            "key_field": "item_id",
            "filter": {
              "op": "equals",
              "field": "item_status",
              "value": "Active"
            },
            "spec": {
              "observation": {
                "dataset": "sales_order_lines",
                "key_field": "item_id",
                "period_field": "order_date",
                "period": "month",
                "success_condition": {
                  "op": "field_lte",
                  "field": "actual_ship_date",
                  "other_field": "requested_ship_date"
                },
                "min_periods": 4,
                "min_samples": 6
              }
            },
            "condition": {
              "op": "gte",
              "field": "computed.kpi_drop",
              "value": 0.15
            },
            "issue": "Share of sales lines shipped on time is materially lower in the recent half of the horizon than in the earlier half",
            "business_impact": "Customer service for this item is deteriorating and the deterioration is measurable in the order book, not only in complaints. Where it coincides with a lead time or buffer finding on the same item, the configuration is the most likely cause.",
            "likely_root_cause": "Supply behaviour changed (supplier performance, volume, allocation) while the planning parameters stayed as they were.",
            "recommended_action": "Review this item together with its lead time and buffer findings, and treat the service trend as the validation of whether the parameter change worked.",
            "owner_field": "planner_id",
            "affected_objects": [
              {
                "label": "Item",
                "field": "item_id"
              }
            ],
            "source_references": [
              "D365_SalesOrderHistory"
            ],
            "tags": [
              "rationality",
              "service_level",
              "trend"
            ]
          },
          {
            "rule_id": "PLN_L3_SERVICE_LEVEL_BELOW_TARGET",
            "title": "On-time shipment share in the recent horizon is below the service target",
            "level": "L3",
            "severity": "high",
            "detector": "detect_kpi_degradation_pattern",
            "entity": "items",
            "key_field": "item_id",
            "filter": {
              "op": "equals",
              "field": "item_status",
              "value": "Active"
            },
            "spec": {
              "observation": {
                "dataset": "sales_order_lines",
                "key_field": "item_id",
                "period_field": "order_date",
                "period": "month",
                "success_condition": {
                  "op": "field_lte",
                  "field": "actual_ship_date",
                  "other_field": "requested_ship_date"
                },
                "min_periods": 4,
                "min_samples": 6
              }
            },
            "condition": {
              "op": "lte",
              "field": "computed.kpi_late",
              "value": 0.75
            },
            "issue": "Fewer than 75% of sales lines in the recent half of the horizon shipped on the requested date",
            "business_impact": "The service level actually delivered for this item is far below what any inventory strategy in the system is dimensioned for. Whatever safety stock and lead time were configured, they are not producing the promise the customer was given, and the gap is being absorbed by expediting and by the customer's patience.",
            "likely_root_cause": "Replenishment parameters were never dimensioned for a service target, or the target was set for the product family and never checked per item.",
            "recommended_action": "Agree an explicit service target for this item, then dimension safety stock and lead time to it rather than inheriting group defaults; re-measure this share after the next full replenishment cycle.",
            "owner_field": "planner_id",
            "affected_objects": [
              {
                "label": "Item",
                "field": "item_id"
              }
            ],
            "source_references": [
              "D365_SalesOrderHistory"
            ],
            "tags": [
              "rationality",
              "service_level",
              "customer_kpi"
            ]
          },
          {
            "rule_id": "PLN_L3_LEADTIME_DRIFT",
            "title": "Actual supplier lead time drifted upwards during the observed horizon",
            "level": "L3",
            "severity": "medium",
            "detector": "detect_process_drift",
            "entity": "items",
            "key_field": "item_id",
            "filter": {
              "op": "all",
              "conditions": [
                {
                  "op": "equals",
                  "field": "item_status",
                  "value": "Active"
                },
                {
                  "op": "equals",
                  "field": "production_type",
                  "value": "Purchased"
                }
              ]
            },
            "spec": {
              "observation": {
                "dataset": "purchase_receipts",
                "key_field": "item_id",
                "metric": "mean",
                "days_between": [
                  "order_date",
                  "actual_receipt_date"
                ],
                "period_field": "order_date",
                "period": "month",
                "min_periods": 4,
                "min_samples": 6
              }
            },
            "condition": {
              "op": "all",
              "conditions": [
                {
                  "op": "ratio_gte",
                  "field": "computed.late",
                  "other_field": "computed.early",
                  "value": 1.3
                },
                {
                  "op": "abs_diff_gte",
                  "field": "computed.late",
                  "other_field": "computed.early",
                  "value": 7
                }
              ]
            },
            "issue": "Supplier delivery behaviour in the later half of the horizon is materially slower than in the earlier half",
            "business_impact": "The configured lead time may have been correct when it was set and is being overtaken by reality right now. Because the whole-horizon average still sits between the old and the new behaviour, the usual configured-versus-actual check stays quiet while every new order is planned on a promise the supplier has already stopped keeping.",
            "likely_root_cause": "A change on the supply side during the horizon - capacity, allocation, sub-supplier, transport mode or a site move - that has not yet been reflected in the planning parameters.",
            "recommended_action": "Ask the buyer what changed at this supplier, and reset the lead time to the recent behaviour rather than the historical average; if the change is temporary, add a safety margin with an explicit review date instead.",
            "owner_field": "planner_id",
            "affected_objects": [
              {
                "label": "Item",
                "field": "item_id"
              },
              {
                "label": "Vendor",
                "field": "primary_vendor_id"
              }
            ],
            "source_references": [
              "D365_DefaultOrderSettings",
              "D365_PurchaseReceiptHistory"
            ],
            "tags": [
              "rationality",
              "lead_time",
              "drift",
              "supplier_performance"
            ]
          },
          {
            "rule_id": "PLN_L3_PO_CONFIRMATION_UNRELIABLE",
            "title": "Receipts arrive materially later than the supplier's own confirmed date",
            "level": "L3",
            "severity": "medium",
            "detector": "detect_historical_behavior_gap",
            "entity": "items",
            "key_field": "item_id",
            "spec": {
              "observation": {
                "dataset": "purchase_receipts",
                "key_field": "item_id",
                "metric": "mean",
                "days_between": [
                  "confirmed_receipt_date",
                  "actual_receipt_date"
                ],
                "min_samples": 3
              },
              "expose_as": "days_after_confirmation"
            },
            "filter": {
              "op": "all",
              "conditions": [
                {
                  "op": "equals",
                  "field": "item_status",
                  "value": "Active"
                },
                {
                  "op": "equals",
                  "field": "production_type",
                  "value": "Purchased"
                }
              ]
            },
            "condition": {
              "op": "gte",
              "field": "computed.days_after_confirmation",
              "value": 7
            },
            "issue": "Purchase order confirmations for this item are systematically optimistic: receipts land well after the confirmed date",
            "business_impact": "The confirmed date is what buyers, planners and customer service all quote downstream, so an unreliable confirmation propagates a date nobody can keep into sales order promises and into every rescheduling decision. Unlike a wrong lead time, this cannot be fixed in the item master: it is a supplier commitment problem, and it needs a conversation rather than a parameter change.",
            "likely_root_cause": "Supplier confirms against a standard lead time rather than against their real queue, or confirmations are auto-generated by the interface without a capacity check.",
            "recommended_action": "Take the measured deviation to the supplier as a delivery reliability item, and until it is resolved plan against observed behaviour rather than the confirmed date.",
            "owner_field": "planner_id",
            "affected_objects": [
              {
                "label": "Item",
                "field": "item_id"
              },
              {
                "label": "Vendor",
                "field": "primary_vendor_id"
              }
            ],
            "source_references": [
              "D365_PurchaseOrderConfirmations",
              "D365_PurchaseReceiptHistory"
            ],
            "tags": [
              "rationality",
              "purchase_orders",
              "supplier_performance"
            ]
          },
          {
            "rule_id": "PLN_L3_PRODUCTION_LEADTIME_GAP",
            "title": "Configured lead time is far shorter than the actual production cycle time",
            "level": "L3",
            "severity": "high",
            "detector": "detect_historical_behavior_gap",
            "entity": "items",
            "key_field": "item_id",
            "spec": {
              "observation": {
                "dataset": "production_orders",
                "key_field": "item_id",
                "metric": "mean",
                "days_between": [
                  "planned_start_date",
                  "actual_end_date"
                ],
                "min_samples": 3
              }
            },
            "filter": {
              "op": "all",
              "conditions": [
                {
                  "op": "equals",
                  "field": "item_status",
                  "value": "Active"
                },
                {
                  "op": "equals",
                  "field": "production_type",
                  "value": "Manufactured"
                }
              ]
            },
            "condition": {
              "op": "all",
              "conditions": [
                {
                  "op": "ratio_gte",
                  "field": "computed.observed",
                  "other_field": "lead_time_days",
                  "value": 1.4
                },
                {
                  "op": "abs_diff_gte",
                  "field": "computed.observed",
                  "other_field": "lead_time_days",
                  "value": 5
                }
              ]
            },
            "issue": "Production orders take materially longer from planned start to actual finish than the configured production lead time",
            "business_impact": "Every dependent demand date derived from this item is wrong by the same margin, and the error compounds up the BOM: the assembly is scheduled against a component that is not there. The visible symptom is chronic late starts and expediting on the shop floor, which is usually blamed on execution rather than on the parameter that caused it.",
            "likely_root_cause": "Production lead time was set from the routing's theoretical run time without queue, setup or wait time, or the route changed while the item lead time did not.",
            "recommended_action": "Reset the production lead time to observed cycle time (or make the route's queue times realistic so the scheduled time matches reality), and re-check the parent items whose dates depend on it.",
            "owner_field": "planner_id",
            "affected_objects": [
              {
                "label": "Item",
                "field": "item_id"
              }
            ],
            "source_references": [
              "D365_DefaultOrderSettings",
              "D365_ProductionOrderHistory"
            ],
            "tags": [
              "rationality",
              "lead_time",
              "production_orders"
            ]
          },
          {
            "rule_id": "PLN_L3_MOQ_VS_DEMAND",
            "title": "Minimum order quantity covers many months of observed demand",
            "level": "L3",
            "severity": "high",
            "detector": "detect_historical_behavior_gap",
            "entity": "items",
            "key_field": "item_id",
            "spec": {
              "observation": {
                "dataset": "sales_order_lines",
                "key_field": "item_id",
                "metric": "mean_by_period",
                "value_field": "qty",
                "period_field": "order_date",
                "period": "month",
                "min_samples": 4
              },
              "expose_as": "monthly_demand"
            },
            "filter": {
              "op": "all",
              "conditions": [
                {
                  "op": "equals",
                  "field": "item_status",
                  "value": "Active"
                },
                {
                  "op": "equals",
                  "field": "production_type",
                  "value": "Purchased"
                }
              ]
            },
            "condition": {
              "op": "all",
              "conditions": [
                {
                  "op": "ratio_gte",
                  "field": "min_order_qty",
                  "other_field": "computed.monthly_demand",
                  "value": 8
                },
                {
                  "op": "abs_diff_gte",
                  "field": "min_order_qty",
                  "other_field": "computed.monthly_demand",
                  "value": 50
                }
              ]
            },
            "issue": "Minimum order quantity is many months of demand, so every replenishment creates structural excess inventory",
            "business_impact": "The lot size, not the demand, decides how much stock this item carries. Each order buys inventory that will sit for most of a year, tying up cash and space and creating obsolescence risk that no coverage setting can drain, because the next order will be just as large.",
            "likely_root_cause": "MOQ was accepted from the supplier's price break or packaging unit without comparing it against real consumption, and nobody has revisited it since the volume changed.",
            "recommended_action": "Renegotiate the minimum order quantity or the packaging unit against the measured monthly demand, or price the excess explicitly so the discount that justified the MOQ can be compared with the carrying cost it creates.",
            "owner_field": "planner_id",
            "affected_objects": [
              {
                "label": "Item",
                "field": "item_id"
              }
            ],
            "source_references": [
              "D365_DefaultOrderSettings",
              "D365_SalesOrderHistory"
            ],
            "tags": [
              "rationality",
              "moq",
              "lot_size",
              "inventory"
            ]
          },
          {
            "rule_id": "PLN_L3_FORECAST_ABOVE_INTAKE",
            "title": "Forecast is persistently far above actual order intake",
            "level": "L3",
            "severity": "medium",
            "detector": "detect_historical_behavior_gap",
            "entity": "items",
            "key_field": "item_id",
            "spec": {
              "observation": {
                "dataset": "sales_order_lines",
                "key_field": "item_id",
                "metric": "mean_by_period",
                "value_field": "qty",
                "period_field": "order_date",
                "period": "month",
                "min_samples": 6
              },
              "expose_as": "monthly_intake",
              "extra_observations": [
                {
                  "expose_as": "monthly_forecast",
                  "dataset": "forecast_lines",
                  "key_field": "item_id",
                  "metric": "mean",
                  "value_field": "forecast_qty",
                  "min_samples": 3
                }
              ]
            },
            "filter": {
              "op": "equals",
              "field": "item_status",
              "value": "Active"
            },
            "condition": {
              "op": "all",
              "conditions": [
                {
                  "op": "ratio_gte",
                  "field": "computed.monthly_forecast",
                  "other_field": "computed.monthly_intake",
                  "value": 1.5
                },
                {
                  "op": "abs_diff_gte",
                  "field": "computed.monthly_forecast",
                  "other_field": "computed.monthly_intake",
                  "value": 20
                }
              ]
            },
            "issue": "Average monthly forecast is far above the average monthly order intake actually recorded",
            "business_impact": "Master planning is supplying a demand that does not arrive. On a forecast-driven item this is the largest single source of excess stock, and because the forecast is reduced by whatever orders do come in, the excess accumulates quietly rather than appearing as one visible error.",
            "likely_root_cause": "Forecast still reflects an ambition, a launch plan or a customer commitment that did not materialise, and no one has been accountable for correcting it since.",
            "recommended_action": "Review this item in the next demand review with both numbers side by side, and either correct the forecast to the observed intake or record explicitly why the higher number is still expected and by when.",
            "owner_field": "planner_id",
            "affected_objects": [
              {
                "label": "Item",
                "field": "item_id"
              }
            ],
            "source_references": [
              "D365_DemandForecast",
              "D365_SalesOrderHistory"
            ],
            "tags": [
              "rationality",
              "forecast",
              "demand"
            ]
          },
          {
            "rule_id": "PLN_L3_EXCESS_INVENTORY_COVER",
            "title": "On-hand stock at this site covers many months of that site's demand",
            "level": "L3",
            "severity": "medium",
            "detector": "detect_historical_behavior_gap",
            "entity": "inventory_on_hand",
            "key_field": [
              "item_id",
              "site_id"
            ],
            "spec": {
              "observation": {
                "dataset": "sales_order_lines",
                "key_field": [
                  "item_id",
                  "site_id"
                ],
                "metric": "mean_by_period",
                "value_field": "qty",
                "period_field": "order_date",
                "period": "month",
                "min_samples": 4
              },
              "expose_as": "monthly_demand"
            },
            "condition": {
              "op": "all",
              "conditions": [
                {
                  "op": "ratio_gte",
                  "field": "on_hand_qty",
                  "other_field": "computed.monthly_demand",
                  "value": 6
                },
                {
                  "op": "abs_diff_gte",
                  "field": "on_hand_qty",
                  "other_field": "computed.monthly_demand",
                  "value": 100
                }
              ]
            },
            "issue": "Physical stock at this item and site is worth more than six months of that site's own demand",
            "business_impact": "Capital and space are committed at a location that does not consume them at that rate. Because the imbalance is per site, a company-wide inventory report can look healthy while one site carries a year of cover and another runs short of the same item - and only the site view shows it.",
            "likely_root_cause": "Stock was pushed to the site by a lot size, a one-off transfer or a demand plan that did not happen, and no site-level coverage policy drains it.",
            "recommended_action": "Compare cover across the sites holding this item and rebalance before ordering more, then set a site-level maximum or coverage policy so the imbalance cannot rebuild unnoticed.",
            "affected_objects": [
              {
                "label": "Item",
                "field": "item_id"
              },
              {
                "label": "Site",
                "field": "site_id"
              }
            ],
            "source_references": [
              "D365_InventoryOnHand",
              "D365_SalesOrderHistory"
            ],
            "tags": [
              "rationality",
              "inventory",
              "site",
              "composite_key"
            ]
          }
        ]
      }
    }
  ];
})(typeof globalThis !== 'undefined' ? globalThis : this);
