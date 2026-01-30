import { useState, useMemo } from 'react';
import { useQuery } from 'react-query';
import {
    Database,
    Search,
    CheckCircle,
    AlertTriangle,
    ChevronRight,
    ChevronDown,
    Trash2,
    Table,
    Columns,
    Info,
    BookOpen,
} from 'lucide-react';
import { connectorsAPI } from '../services/api';
import { useToast } from '../store/toastStore';
import { ALL_PACKAGES } from '../data/regulationPackages';

/**
 * CDM Field Definitions
 *
 * Based on the ISDA/FINOS Common Domain Model (CDM) standard.
 * Source: https://cdm.finos.org/
 *
 * Definitions marked with [ISDA CDM] are directly from the official specification.
 * Definitions marked with [DRR] are from the Digital Regulatory Reporting initiative.
 * Other definitions are regulatory reporting interpretations aligned with CDM concepts.
 */
const CDM_DEFINITIONS: Record<string, { definition: string; dataType: string; example?: string; source?: 'ISDA CDM' | 'DRR' | 'placeholder' }> = {
    // Trade Domain
    'trade.uti': { definition: 'Unique Transaction Identifier - A globally unique identifier assigned to each reportable derivative transaction per ISO 23897.', dataType: 'string', example: 'CITI00000000000000000001' },
    'trade.prior_uti': { definition: 'UTI of the predecessor transaction in case of amendment or novation.', dataType: 'string' },
    'trade.execution_timestamp': { definition: 'Date and time when the transaction was executed, in UTC timezone.', dataType: 'datetime', example: '2024-01-15T14:30:00Z' },
    'trade.effective_date': { definition: 'Unadjusted date when the contract becomes effective and obligations begin.', dataType: 'date', example: '2024-01-17' },
    'trade.maturity_date': { definition: 'Unadjusted date when the contract expires and obligations end.', dataType: 'date', example: '2029-01-17' },
    'trade.termination_date': { definition: 'Date when the contract was terminated early, if applicable.', dataType: 'date' },
    'trade.event_timestamp': { definition: 'Date and time of the lifecycle event being reported.', dataType: 'datetime' },
    'trade.event_type': { definition: 'Type of lifecycle event (TRAD=new trade, NOVA=novation, COMP=compression, etc.).', dataType: 'enum' },
    'trade.action_type': { definition: 'Action being performed on the report (NEWT=new, MODI=modify, CORR=correct, TERM=terminate).', dataType: 'enum' },

    // Transaction Domain
    'transaction.prior_uti': { definition: 'UTI of the prior transaction that was modified, novated, or terminated.', dataType: 'string' },
    'transaction.subsequent_position_uti': { definition: 'UTI of the position into which this transaction was included.', dataType: 'string' },
    'transaction.post_trade_risk_reduction': { definition: 'Indicates if the transaction results from a post-trade risk reduction service.', dataType: 'boolean' },
    'transaction.post_trade_risk_reduction_event_type': { definition: 'Type of PTRR service (CMPR=compression, RPNT=rebalancing, CAPR=capital optimization).', dataType: 'enum' },
    'transaction.package_transaction': { definition: 'Indicates if this trade is part of a package of transactions executed together.', dataType: 'boolean' },
    'transaction.package_identifier': { definition: 'Identifier of the package if the transaction is part of one.', dataType: 'string' },
    'transaction.intragroup_transaction': { definition: 'Indicates if the transaction is between entities within the same group.', dataType: 'boolean' },

    // Party/Counterparty Domain
    'party.reporting_counterparty.lei': { definition: 'Legal Entity Identifier of the reporting counterparty per ISO 17442.', dataType: 'string', example: 'HWUPKR0MPOU8FGXBT394' },
    'party.reporting_counterparty.name': { definition: 'Legal name of the reporting counterparty as registered.', dataType: 'string' },
    'party.other_counterparty.lei': { definition: 'Legal Entity Identifier of the other counterparty to the transaction.', dataType: 'string' },
    'party.other_counterparty.name': { definition: 'Legal name of the other counterparty if no LEI available.', dataType: 'string' },
    'party.beneficiary.lei': { definition: 'LEI of the beneficiary if different from the reporting counterparty.', dataType: 'string' },
    'party.broker.lei': { definition: 'LEI of the broker if applicable to the transaction.', dataType: 'string' },
    'party.clearing_member.lei': { definition: 'LEI of the clearing member through which the trade is cleared.', dataType: 'string' },
    'party.ccp.lei': { definition: 'LEI of the Central Counterparty Clearing House.', dataType: 'string' },
    'party.execution_agent.lei': { definition: 'LEI of the entity that executed the transaction on behalf of a party.', dataType: 'string' },
    'party.buyer.lei': { definition: 'LEI of the buyer in the transaction (payer of fixed leg in swaps).', dataType: 'string' },
    'party.seller.lei': { definition: 'LEI of the seller in the transaction (receiver of fixed leg in swaps).', dataType: 'string' },
    'party.submitter.lei': { definition: 'LEI of the entity submitting the report to the trade repository.', dataType: 'string' },
    'party.country': { definition: 'ISO 3166-1 alpha-2 country code of the counterparty domicile.', dataType: 'string', example: 'GB' },
    'party.corporate_sector': { definition: 'Classification of the counterparty (FC=financial, NFC=non-financial).', dataType: 'enum' },
    'party.nature': { definition: 'Detailed nature classification of the entity type.', dataType: 'enum' },

    // Counterparty Domain
    'counterparty.reporting_lei': { definition: 'LEI of the entity with the reporting obligation.', dataType: 'string' },
    'counterparty.other_lei': { definition: 'LEI of the other party to the derivative contract.', dataType: 'string' },
    'counterparty.other_name': { definition: 'Name of the other counterparty when LEI is not available.', dataType: 'string' },
    'counterparty.beneficiary_lei': { definition: 'LEI of the beneficiary of the contract if different from reporter.', dataType: 'string' },
    'counterparty.broker_lei': { definition: 'LEI of the intermediary broker.', dataType: 'string' },
    'counterparty.clearing_member_lei': { definition: 'LEI of the clearing member for cleared transactions.', dataType: 'string' },
    'counterparty.ccp_lei': { definition: 'LEI of the CCP for centrally cleared transactions.', dataType: 'string' },
    'counterparty.nfc_financial_nature': { definition: 'For NFC counterparties, indicates if acting in financial capacity.', dataType: 'boolean' },
    'counterparty.clearing_threshold': { definition: 'Clearing threshold status of the reporting counterparty (ABOV/BLWT).', dataType: 'enum' },
    'counterparty.other_clearing_threshold': { definition: 'Clearing threshold status of the other counterparty.', dataType: 'enum' },

    // Product Domain
    'product.classification': { definition: 'CFI code or ISDA product taxonomy classification.', dataType: 'string', example: 'SRCCSP' },
    'product.underlying_asset': { definition: 'Identifier of the underlying asset (ISIN, index name, etc.).', dataType: 'string' },
    'product.underlying_identifier': { definition: 'Unique identifier of the underlying instrument.', dataType: 'string' },
    'product.underlying_identification_type': { definition: 'Type of identifier used for the underlying (ISIN, CUSIP, etc.).', dataType: 'enum' },
    'product.underlying_index_name': { definition: 'Name of the underlying index for index-based derivatives.', dataType: 'string', example: 'EUR-EURIBOR-Reuters' },
    'product.underlying_index_term_value': { definition: 'Numeric tenor value for index-based products.', dataType: 'integer', example: '3' },
    'product.underlying_index_term_unit': { definition: 'Unit of the index term (DAYS, WEEK, MNTH, YEAR).', dataType: 'enum' },
    'product.underlying_issuer_lei': { definition: 'LEI of the issuer of the underlying instrument.', dataType: 'string' },
    'product.underlying_country': { definition: 'Country of the underlying for equity derivatives.', dataType: 'string' },
    'product.asset_class': { definition: 'High-level classification (IR=interest rate, CR=credit, FX, CO=commodity, EQ=equity).', dataType: 'enum' },
    'product.contract_type': { definition: 'Derivative contract type (SWAP, OPTN, FUTR, FXFW, etc.).', dataType: 'enum' },
    'product.upi': { definition: 'Unique Product Identifier per ISO 4914 for standardized identification.', dataType: 'string' },
    'product.isin': { definition: 'ISIN code if the derivative is exchange-traded or has an assigned ISIN.', dataType: 'string' },
    'product.notional_currency': { definition: 'Currency of the notional amount per ISO 4217.', dataType: 'string', example: 'EUR' },
    'product.notional_currency_2': { definition: 'Second notional currency for cross-currency products.', dataType: 'string' },
    'product.settlement_currency': { definition: 'Currency in which cash settlement occurs.', dataType: 'string' },
    'product.delivery_currency': { definition: 'Currency delivered in physically settled FX transactions.', dataType: 'string' },
    'product.notional_amount': { definition: 'Notional or principal amount of the first leg.', dataType: 'decimal', example: '10000000' },
    'product.notional_amount_leg1': { definition: 'Notional amount for the first leg of the swap.', dataType: 'decimal' },
    'product.notional_amount_leg2': { definition: 'Notional amount for the second leg of the swap.', dataType: 'decimal' },
    'product.quantity': { definition: 'Number of contracts or units for exchange-traded derivatives.', dataType: 'decimal' },
    'product.price': { definition: 'Execution price of the derivative transaction.', dataType: 'decimal' },
    'product.price_currency': { definition: 'Currency in which the price is denominated.', dataType: 'string' },
    'product.price_notation': { definition: 'How the price is expressed (MONE=monetary, PERC=percentage, YIEL=yield).', dataType: 'enum' },
    'product.fixed_rate': { definition: 'Fixed interest rate for the fixed leg of an interest rate swap.', dataType: 'decimal', example: '0.025' },
    'product.fixed_rate_leg1': { definition: 'Fixed rate applicable to the first leg.', dataType: 'decimal' },
    'product.fixed_rate_leg2': { definition: 'Fixed rate applicable to the second leg.', dataType: 'decimal' },
    'product.floating_rate_leg1': { definition: 'Floating rate index for the first leg (e.g., EURIBOR).', dataType: 'string' },
    'product.floating_rate_leg2': { definition: 'Floating rate index for the second leg.', dataType: 'string' },
    'product.spread_leg1': { definition: 'Spread over the floating rate index for leg 1 in basis points.', dataType: 'decimal' },
    'product.spread_leg2': { definition: 'Spread over the floating rate index for leg 2 in basis points.', dataType: 'decimal' },
    'product.spread_notation': { definition: 'How the spread is expressed (BDSP=basis points, PERC=percentage).', dataType: 'enum' },
    'product.payment_frequency_leg1': { definition: 'Payment frequency for leg 1 (e.g., 3M, 6M, 1Y).', dataType: 'string' },
    'product.payment_frequency_leg2': { definition: 'Payment frequency for leg 2.', dataType: 'string' },
    'product.day_count_leg1': { definition: 'Day count convention for leg 1 (ACT/360, 30/360, etc.).', dataType: 'enum' },
    'product.day_count_leg2': { definition: 'Day count convention for leg 2.', dataType: 'enum' },
    'product.maturity_date': { definition: 'Maturity or expiry date of the derivative contract.', dataType: 'date' },
    'product.expiry_date': { definition: 'Expiration date for options and futures.', dataType: 'date' },
    'product.delivery_type': { definition: 'Settlement method (PHYS=physical, CASH=cash settled, OPTL=optional).', dataType: 'enum' },

    // Option-specific fields
    'product.option_type': { definition: 'Type of option (CALL or PUTO for put).', dataType: 'enum' },
    'product.option_exercise_style': { definition: 'Exercise style (AMER=American, EURO=European, BERM=Bermudan).', dataType: 'enum' },
    'product.strike_price': { definition: 'Strike price at which the option can be exercised.', dataType: 'decimal' },
    'product.strike_price_currency': { definition: 'Currency of the strike price.', dataType: 'string' },
    'product.strike_price_notation': { definition: 'How the strike price is expressed.', dataType: 'enum' },
    'product.strike_schedule_effective_date': { definition: 'Effective date for scheduled strike price changes.', dataType: 'date' },
    'product.strike_schedule_end_date': { definition: 'End date for the strike price schedule.', dataType: 'date' },
    'product.strike_schedule_price': { definition: 'Strike price in the schedule.', dataType: 'decimal' },
    'product.option_premium_amount': { definition: 'Premium paid for the option contract.', dataType: 'decimal' },
    'product.option_premium_currency': { definition: 'Currency of the option premium.', dataType: 'string' },
    'product.option_premium_payment_date': { definition: 'Date when the option premium is paid.', dataType: 'date' },
    'product.option_maturity_date_unadjusted': { definition: 'Unadjusted maturity date for the option.', dataType: 'date' },
    'product.first_exercise_date': { definition: 'First date an American/Bermudan option can be exercised.', dataType: 'date' },
    'product.option_barrier_type': { definition: 'Type of barrier for exotic options (KIKO, KOKI, etc.).', dataType: 'enum' },
    'product.option_barrier_level': { definition: 'Barrier level price for barrier options.', dataType: 'decimal' },

    // Credit derivative fields
    'product.reference_entity': { definition: 'Name of the reference entity for credit derivatives.', dataType: 'string' },
    'product.reference_entity_lei': { definition: 'LEI of the credit derivative reference entity.', dataType: 'string' },
    'product.reference_obligation_type': { definition: 'Type of reference obligation (senior, subordinated, etc.).', dataType: 'enum' },
    'product.reference_obligation_isin': { definition: 'ISIN of the specific reference obligation.', dataType: 'string' },
    'product.seniority': { definition: 'Seniority level of the credit derivative.', dataType: 'enum' },
    'product.index_series': { definition: 'Series number of a credit index.', dataType: 'integer' },
    'product.index_version': { definition: 'Version of the credit index series.', dataType: 'integer' },
    'product.index_factor': { definition: 'Current index factor for credit indices.', dataType: 'decimal' },
    'product.is_tranched': { definition: 'Indicates if the credit derivative is tranched.', dataType: 'boolean' },
    'product.credit_event_type': { definition: 'Type of credit event if one has occurred.', dataType: 'enum' },

    // Commodity-specific fields
    'product.commodity_base': { definition: 'Base commodity category (AGRI, NRGY, METL, etc.).', dataType: 'enum' },
    'product.commodity_detail': { definition: 'Detailed commodity sub-type within the base category.', dataType: 'string' },
    'product.delivery_point': { definition: 'Physical delivery point for commodity contracts.', dataType: 'string' },
    'product.delivery_zone': { definition: 'EIC code for energy delivery zone (EU energy markets).', dataType: 'string' },
    'product.interconnection_point': { definition: 'EIC code for gas interconnection point.', dataType: 'string' },
    'product.load_type': { definition: 'Load profile type for electricity (BASE, PEAK, OFFP).', dataType: 'enum' },
    'product.load_delivery_intervals': { definition: 'Delivery intervals for load-shaped products.', dataType: 'string' },
    'product.delivery_start_datetime': { definition: 'Start date/time for commodity delivery period.', dataType: 'datetime' },
    'product.delivery_end_datetime': { definition: 'End date/time for commodity delivery period.', dataType: 'datetime' },
    'product.duration': { definition: 'Duration category of the commodity contract.', dataType: 'enum' },

    // FX-specific fields
    'product.exchange_rate': { definition: 'Exchange rate for FX transactions.', dataType: 'decimal' },
    'product.exchange_rate_basis': { definition: 'Quote convention for the exchange rate.', dataType: 'string' },
    'product.forward_exchange_rate': { definition: 'Forward exchange rate for FX forwards.', dataType: 'decimal' },
    'product.fx_settlement_date': { definition: 'Settlement date for FX transactions.', dataType: 'date' },
    'product.delivery_currency_2': { definition: 'Second delivery currency for FX transactions.', dataType: 'string' },
    'product.delivery_amount': { definition: 'Amount of currency to be delivered.', dataType: 'decimal' },
    'product.delivery_amount_2': { definition: 'Amount of second currency to be delivered.', dataType: 'decimal' },
    'product.fx_option_type': { definition: 'Type of FX option (vanilla, barrier, digital, etc.).', dataType: 'enum' },

    // Basket-related fields
    'product.basket_constituent_id': { definition: 'Identifier of a constituent in a basket product.', dataType: 'string' },
    'product.basket_constituent_weight': { definition: 'Weight/proportion of the constituent in the basket.', dataType: 'decimal' },
    'product.custom_basket_code': { definition: 'Identifier code for a custom basket.', dataType: 'string' },

    // Execution Domain
    'execution.venue': { definition: 'MIC code of the execution venue or XXXX for OTC.', dataType: 'string', example: 'XLON' },
    'execution.venue_type': { definition: 'Type of venue (exchange, MTF, OTF, systematic internalizer).', dataType: 'enum' },
    'execution.execution_type': { definition: 'How the trade was executed (electronic, voice, etc.).', dataType: 'enum' },
    'execution.platform_identifier': { definition: 'MIC code of the trading platform.', dataType: 'string' },
    'execution.timestamp': { definition: 'Precise timestamp of trade execution in UTC.', dataType: 'datetime' },

    // Trade Event Domain
    'trade_event.confirmation_timestamp': { definition: 'Timestamp when the trade was confirmed.', dataType: 'datetime' },
    'trade_event.confirmation_means': { definition: 'Method of confirmation (ELEC=electronic, NONELEC=non-electronic).', dataType: 'enum' },
    'trade_event.is_compressed': { definition: 'Indicates if contract results from portfolio compression.', dataType: 'boolean' },
    'trade_event.settlement_location': { definition: 'Location where settlement occurs.', dataType: 'string' },

    // Clearing Domain
    'clearing.is_cleared': { definition: 'Indicates whether the derivative is centrally cleared.', dataType: 'boolean' },
    'clearing.ccp_lei': { definition: 'LEI of the Central Counterparty.', dataType: 'string' },
    'clearing.clearing_member_lei': { definition: 'LEI of the clearing member.', dataType: 'string' },
    'clearing.clearing_timestamp': { definition: 'Timestamp when clearing occurred.', dataType: 'datetime' },
    'clearing.clearing_obligation': { definition: 'Indicates if subject to mandatory clearing.', dataType: 'boolean' },
    'clearing.clearing_exemption': { definition: 'Exemption from clearing obligation if applicable.', dataType: 'enum' },
    'clearing.intragroup_exemption': { definition: 'Indicates if intragroup exemption applies.', dataType: 'boolean' },

    // Collateral Domain
    'collateral.is_collateralized': { definition: 'Indicates whether collateral is exchanged.', dataType: 'boolean' },
    'collateral.collateralization_type': { definition: 'Type of collateral arrangement (FC=full, PC=partial, UC=uncollateralized, OC=one-way).', dataType: 'enum' },
    'collateral.initial_margin_posted': { definition: 'Amount of initial margin posted by the reporting counterparty.', dataType: 'decimal' },
    'collateral.initial_margin_posted_currency': { definition: 'Currency of the posted initial margin.', dataType: 'string' },
    'collateral.initial_margin_received': { definition: 'Amount of initial margin received.', dataType: 'decimal' },
    'collateral.initial_margin_received_currency': { definition: 'Currency of received initial margin.', dataType: 'string' },
    'collateral.variation_margin_posted': { definition: 'Amount of variation margin posted.', dataType: 'decimal' },
    'collateral.variation_margin_posted_currency': { definition: 'Currency of posted variation margin.', dataType: 'string' },
    'collateral.variation_margin_received': { definition: 'Amount of variation margin received.', dataType: 'decimal' },
    'collateral.variation_margin_received_currency': { definition: 'Currency of received variation margin.', dataType: 'string' },
    'collateral.excess_collateral_posted': { definition: 'Excess collateral posted above requirements.', dataType: 'decimal' },
    'collateral.excess_collateral_posted_currency': { definition: 'Currency of excess collateral posted.', dataType: 'string' },
    'collateral.excess_collateral_received': { definition: 'Excess collateral received above requirements.', dataType: 'decimal' },
    'collateral.excess_collateral_received_currency': { definition: 'Currency of excess collateral received.', dataType: 'string' },
    'collateral.collateral_portfolio_code': { definition: 'Identifier of the collateral portfolio.', dataType: 'string' },
    'collateral.collateral_timestamp': { definition: 'Timestamp when collateral values were determined.', dataType: 'datetime' },

    // Margin Domain
    'margin.action_type': { definition: 'Action type for margin report (MARU=update, CORR=correction).', dataType: 'enum' },
    'margin.im_posted': { definition: 'Initial margin amount posted.', dataType: 'decimal' },
    'margin.im_posted_currency': { definition: 'Currency of posted initial margin.', dataType: 'string' },
    'margin.im_received': { definition: 'Initial margin amount received.', dataType: 'decimal' },
    'margin.im_received_currency': { definition: 'Currency of received initial margin.', dataType: 'string' },
    'margin.vm_posted': { definition: 'Variation margin amount posted.', dataType: 'decimal' },
    'margin.vm_posted_currency': { definition: 'Currency of posted variation margin.', dataType: 'string' },
    'margin.vm_received': { definition: 'Variation margin amount received.', dataType: 'decimal' },
    'margin.vm_received_currency': { definition: 'Currency of received variation margin.', dataType: 'string' },
    'margin.timestamp': { definition: 'Timestamp of the margin calculation.', dataType: 'datetime' },

    // Valuation Domain
    'valuation.value': { definition: 'Mark-to-market or mark-to-model value of the derivative.', dataType: 'decimal' },
    'valuation.currency': { definition: 'Currency in which the valuation is expressed.', dataType: 'string' },
    'valuation.timestamp': { definition: 'Timestamp when valuation was calculated.', dataType: 'datetime' },
    'valuation.method': { definition: 'Valuation methodology used (MARK=mark-to-market, MODL=mark-to-model).', dataType: 'enum' },
    'valuation.delta': { definition: 'Option delta - rate of change of option value with underlying.', dataType: 'decimal' },
    'valuation.action_type': { definition: 'Action type for valuation report (VALU=update, CORR=correction).', dataType: 'enum' },

    // Position Domain
    'position.position_type': { definition: 'Whether position is reported gross or net.', dataType: 'enum' },
    'position.quantity': { definition: 'Number of contracts in the position.', dataType: 'decimal' },
    'position.notional_amount_leg1': { definition: 'Total notional of leg 1 in the position.', dataType: 'decimal' },
    'position.notional_currency_leg1': { definition: 'Currency of leg 1 notional.', dataType: 'string' },
    'position.notional_amount_leg2': { definition: 'Total notional of leg 2 in the position.', dataType: 'decimal' },
    'position.notional_currency_leg2': { definition: 'Currency of leg 2 notional.', dataType: 'string' },
    'position.effective_date': { definition: 'Effective date of the position.', dataType: 'date' },
    'position.maturity_date': { definition: 'Maturity date of the position.', dataType: 'date' },
    'position.action_type': { definition: 'Action type for position report.', dataType: 'enum' },
    'position.event_type': { definition: 'Lifecycle event type for the position.', dataType: 'enum' },
    'position.reference_date': { definition: 'Reference date for which position is reported.', dataType: 'date' },
    'position.settlement_amount': { definition: 'Settlement amount for the position.', dataType: 'decimal' },
    'position.settlement_currency': { definition: 'Currency of the settlement amount.', dataType: 'string' },
    'position.fixed_rate_leg1': { definition: 'Fixed rate for leg 1 of the position.', dataType: 'decimal' },
    'position.fixed_rate_leg2': { definition: 'Fixed rate for leg 2 of the position.', dataType: 'decimal' },
    'position.floating_rate_leg1': { definition: 'Floating rate index for leg 1 of position.', dataType: 'string' },
    'position.floating_rate_leg2': { definition: 'Floating rate index for leg 2 of position.', dataType: 'string' },
    'position.timestamp': { definition: 'Timestamp of the position calculation.', dataType: 'datetime' },

    // Reporting Domain
    'reporting.submitting_entity_id': { definition: 'LEI of the entity submitting the report.', dataType: 'string' },
    'reporting.responsible_entity_id': { definition: 'LEI of the entity responsible for reporting.', dataType: 'string' },
    'reporting.report_timestamp': { definition: 'Timestamp when the report was submitted.', dataType: 'datetime' },
    'reporting.trade_repository': { definition: 'Identifier of the trade repository receiving the report.', dataType: 'string' },

    // Risk Mitigation Domain
    'risk_mitigation.portfolio_compression': { definition: 'Indicates if subject to portfolio compression.', dataType: 'boolean' },
    'risk_mitigation.dispute_resolution': { definition: 'Indicates if subject to dispute resolution procedures.', dataType: 'boolean' },
    'risk_mitigation.portfolio_reconciliation': { definition: 'Indicates if subject to portfolio reconciliation.', dataType: 'boolean' },
    'risk_mitigation.confirmation_type': { definition: 'Type of confirmation process used.', dataType: 'enum' },

    // Documentation Domain
    'documentation.master_agreement_type': { definition: 'Type of master agreement (ISDA, EFET, etc.).', dataType: 'enum' },
    'documentation.master_agreement_version': { definition: 'Version/year of the master agreement.', dataType: 'string', example: '2002' },
    'documentation.master_confirmation_type': { definition: 'Type of master confirmation agreement.', dataType: 'string' },
    'documentation.other_master_agreement_type': { definition: 'Name of non-standard master agreement.', dataType: 'string' },
};

// Extract all unique CDM paths from all packages
const getAllCdmPaths = () => {
    const pathMap = new Map<string, { path: string; usedBy: string[]; description?: string; definition?: string; dataType?: string; example?: string }>();

    ALL_PACKAGES.forEach(pkg => {
        pkg.fields.forEach(field => {
            if (field.cdm_path) {
                const existing = pathMap.get(field.cdm_path);
                const cdmDef = CDM_DEFINITIONS[field.cdm_path];

                if (existing) {
                    if (!existing.usedBy.includes(pkg.regulation_code)) {
                        existing.usedBy.push(pkg.regulation_code);
                    }
                } else {
                    pathMap.set(field.cdm_path, {
                        path: field.cdm_path,
                        usedBy: [pkg.regulation_code],
                        description: field.description,
                        definition: cdmDef?.definition,
                        dataType: cdmDef?.dataType,
                        example: cdmDef?.example
                    });
                }
            }
        });
    });

    return Array.from(pathMap.values()).sort((a, b) => a.path.localeCompare(b.path));
};

// CDM Mapping interface
interface CdmMapping {
    cdm_path: string;
    connector_id: string | null;
    connector_name?: string;
    schema_name: string | null;
    table_name: string | null;
    column_name: string | null;
    transformation: string | null;
}

// Path info type
interface PathInfo {
    path: string;
    usedBy: string[];
    description?: string;
    definition?: string;
    dataType?: string;
    example?: string;
}

// Group paths by top-level domain
const groupPathsByDomain = (paths: PathInfo[]) => {
    const groups: Record<string, PathInfo[]> = {};
    paths.forEach(p => {
        const domain = p.path.split('.')[0];
        if (!groups[domain]) {
            groups[domain] = [];
        }
        groups[domain].push(p);
    });
    return groups;
};

export default function CDM() {
    const { showSuccess } = useToast();

    const [searchTerm, setSearchTerm] = useState('');
    const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set(['trade', 'party', 'product']));
    const [selectedPath, setSelectedPath] = useState<string | null>(null);
    const [editingMapping, setEditingMapping] = useState<CdmMapping | null>(null);

    // Local state for CDM mappings (in real app, this would come from backend)
    const [cdmMappings, setCdmMappings] = useState<CdmMapping[]>(() => {
        // Try to load from localStorage
        const saved = localStorage.getItem('cdm_mappings');
        return saved ? JSON.parse(saved) : [];
    });

    // Save mappings to localStorage whenever they change
    const saveMappings = (mappings: CdmMapping[]) => {
        setCdmMappings(mappings);
        localStorage.setItem('cdm_mappings', JSON.stringify(mappings));
    };

    // Fetch connectors
    const { data: connectors } = useQuery(
        'connectors',
        async () => {
            const res = await connectorsAPI.list();
            return res.data;
        }
    );

    // Fetch tables for selected connector
    const [selectedConnector, setSelectedConnector] = useState<string>('');
    const { data: tables, isLoading: tablesLoading } = useQuery(
        ['connector-tables', selectedConnector],
        async () => {
            const res = await connectorsAPI.getTables(selectedConnector);
            // Backend returns { tables: [...] }
            return res.data.tables || [];
        },
        { enabled: !!selectedConnector }
    );

    // Fetch columns for selected table
    const [selectedTable, setSelectedTable] = useState<string>('');
    const { data: columns, isLoading: columnsLoading } = useQuery(
        ['connector-columns', selectedConnector, selectedTable],
        async () => {
            const res = await connectorsAPI.getColumns(selectedConnector, selectedTable);
            // Backend returns { columns: [...] }
            return res.data.columns || [];
        },
        { enabled: !!selectedConnector && !!selectedTable }
    );

    // Get all CDM paths
    const allPaths = useMemo(() => getAllCdmPaths(), []);

    // Filter paths - searches path, regulations, definitions, and descriptions
    const filteredPaths = useMemo(() => {
        if (!searchTerm) return allPaths;
        const search = searchTerm.toLowerCase();
        return allPaths.filter(p =>
            p.path.toLowerCase().includes(search) ||
            p.usedBy.some(r => r.toLowerCase().includes(search)) ||
            (p.definition && p.definition.toLowerCase().includes(search)) ||
            (p.description && p.description.toLowerCase().includes(search)) ||
            (p.dataType && p.dataType.toLowerCase().includes(search))
        );
    }, [allPaths, searchTerm]);

    // Group filtered paths
    const groupedPaths = useMemo(() => groupPathsByDomain(filteredPaths), [filteredPaths]);

    // Get mapping for a path
    const getMapping = (path: string): CdmMapping | undefined => {
        return cdmMappings.find(m => m.cdm_path === path);
    };

    // Count mapped paths
    const mappedCount = cdmMappings.filter(m => m.connector_id && m.table_name && m.column_name).length;

    // Toggle domain expansion
    const toggleDomain = (domain: string) => {
        const newExpanded = new Set(expandedDomains);
        if (newExpanded.has(domain)) {
            newExpanded.delete(domain);
        } else {
            newExpanded.add(domain);
        }
        setExpandedDomains(newExpanded);
    };

    // Start editing a mapping
    const startEditMapping = (path: string) => {
        const existing = getMapping(path);
        setEditingMapping(existing || {
            cdm_path: path,
            connector_id: null,
            schema_name: null,
            table_name: null,
            column_name: null,
            transformation: null
        });
        setSelectedPath(path);
        setSelectedConnector(existing?.connector_id || '');
        setSelectedTable(existing?.table_name || '');
    };

    // Save mapping
    const saveMapping = () => {
        if (!editingMapping) return;

        const newMappings = cdmMappings.filter(m => m.cdm_path !== editingMapping.cdm_path);

        if (editingMapping.connector_id && editingMapping.table_name && editingMapping.column_name) {
            // Add connector name for display
            const connector = connectors?.find((c: any) => c.id === editingMapping.connector_id);
            newMappings.push({
                ...editingMapping,
                connector_name: connector?.name
            });
        }

        saveMappings(newMappings);
        setEditingMapping(null);
        setSelectedPath(null);
        showSuccess('Mapping Saved', `CDM path "${editingMapping.cdm_path}" has been configured.`);
    };

    // Delete mapping
    const deleteMapping = (path: string) => {
        const newMappings = cdmMappings.filter(m => m.cdm_path !== path);
        saveMappings(newMappings);
        showSuccess('Mapping Removed', `CDM path "${path}" mapping has been removed.`);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Common Domain Model</h1>
                    <p className="text-gray-500 mt-1">
                        Map CDM paths to your data sources. These mappings are used across all reports.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-sm text-gray-500">
                        <span className={mappedCount > 0 ? 'text-green-600 font-medium' : ''}>
                            {mappedCount}
                        </span> of {allPaths.length} paths configured
                    </div>
                </div>
            </div>

            {/* Info banner */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                    <Database className="w-5 h-5 text-purple-600 mt-0.5" />
                    <div>
                        <h3 className="font-medium text-purple-900">How CDM Mapping Works</h3>
                        <p className="text-sm text-purple-700 mt-1">
                            Each CDM path (e.g., <code className="bg-purple-100 px-1 rounded">trade.execution.price</code>) can be mapped to a specific column in your database.
                            When reports reference this CDM path, data is automatically pulled from the configured source.
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-6">
                {/* Left panel: Path browser */}
                <div className="col-span-2 space-y-4">
                    {/* Search */}
                    <div className="space-y-1">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                className="input pl-10"
                                placeholder="Search paths, definitions, data types, or regulations..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        {searchTerm && (
                            <p className="text-xs text-gray-500 px-1">
                                Found {filteredPaths.length} paths matching "{searchTerm}"
                            </p>
                        )}
                    </div>

                    {/* Path tree */}
                    <div className="card divide-y divide-gray-100">
                        {Object.entries(groupedPaths).map(([domain, paths]) => (
                            <div key={domain}>
                                {/* Domain header */}
                                <button
                                    onClick={() => toggleDomain(domain)}
                                    className="w-full flex items-center gap-2 px-4 py-3 hover:bg-gray-50 text-left"
                                >
                                    {expandedDomains.has(domain) ? (
                                        <ChevronDown className="w-4 h-4 text-gray-400" />
                                    ) : (
                                        <ChevronRight className="w-4 h-4 text-gray-400" />
                                    )}
                                    <span className="font-medium text-gray-900 capitalize">{domain}</span>
                                    <span className="text-xs text-gray-400">({paths.length} paths)</span>
                                    <span className="ml-auto text-xs text-green-600">
                                        {paths.filter(p => getMapping(p.path)?.column_name).length} configured
                                    </span>
                                </button>

                                {/* Domain paths */}
                                {expandedDomains.has(domain) && (
                                    <div className="bg-gray-50 border-t border-gray-100">
                                        {paths.map(({ path, usedBy, definition, dataType, example }) => {
                                            const mapping = getMapping(path);
                                            const isConfigured = mapping?.connector_id && mapping?.table_name && mapping?.column_name;
                                            const isSelected = selectedPath === path;

                                            return (
                                                <button
                                                    key={path}
                                                    onClick={() => startEditMapping(path)}
                                                    className={`w-full flex items-start gap-3 px-4 py-3 text-left border-l-2 transition-colors ${
                                                        isSelected
                                                            ? 'bg-purple-50 border-purple-500'
                                                            : 'border-transparent hover:bg-gray-100'
                                                    }`}
                                                >
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <code className="text-sm text-purple-700 font-medium">{path}</code>
                                                            {dataType && (
                                                                <span className="px-1.5 py-0.5 text-xs bg-gray-200 text-gray-600 rounded font-mono">
                                                                    {dataType}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {definition && (
                                                            <p className="text-xs text-gray-600 mt-1 line-clamp-2">{definition}</p>
                                                        )}
                                                        {example && (
                                                            <p className="text-xs text-gray-400 mt-0.5">
                                                                Example: <code className="bg-gray-100 px-1 rounded">{example}</code>
                                                            </p>
                                                        )}
                                                        <div className="flex items-center gap-2 mt-1.5">
                                                            {usedBy.map(reg => (
                                                                <span
                                                                    key={reg}
                                                                    className={`px-1.5 py-0.5 text-xs rounded ${
                                                                        reg === 'EMIR' ? 'bg-blue-100 text-blue-700' :
                                                                        reg === 'MIFIR' ? 'bg-purple-100 text-purple-700' :
                                                                        reg === 'SFTR' ? 'bg-green-100 text-green-700' :
                                                                        reg === 'CFTC' ? 'bg-amber-100 text-amber-700' :
                                                                        reg === 'ASIC' ? 'bg-cyan-100 text-cyan-700' :
                                                                        'bg-gray-100 text-gray-700'
                                                                    }`}
                                                                >
                                                                    {reg}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    {isConfigured ? (
                                                        <div className="flex items-center gap-2 text-green-600 shrink-0">
                                                            <CheckCircle className="w-4 h-4" />
                                                            <span className="text-xs">{mapping.table_name}.{mapping.column_name}</span>
                                                        </div>
                                                    ) : (
                                                        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right panel: Mapping editor */}
                <div className="space-y-4">
                    <div className="card p-4">
                        <h3 className="font-medium text-gray-900 mb-4">Configure Data Source</h3>

                        {selectedPath ? (
                            <div className="space-y-4">
                                {/* Selected path info */}
                                <div>
                                    <label className="input-label">CDM Path</label>
                                    <code className="block text-sm bg-purple-50 text-purple-700 px-3 py-2 rounded font-medium">
                                        {selectedPath}
                                    </code>
                                </div>

                                {/* Definition */}
                                {(() => {
                                    const pathInfo = allPaths.find(p => p.path === selectedPath);
                                    return pathInfo?.definition ? (
                                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                                            <label className="input-label text-gray-600">Definition</label>
                                            <p className="text-sm text-gray-800 mt-1">{pathInfo.definition}</p>
                                            <div className="flex items-center gap-3 mt-2">
                                                {pathInfo.dataType && (
                                                    <span className="text-xs">
                                                        <strong>Type:</strong>{' '}
                                                        <code className="bg-gray-200 px-1 rounded">{pathInfo.dataType}</code>
                                                    </span>
                                                )}
                                                {pathInfo.example && (
                                                    <span className="text-xs">
                                                        <strong>Example:</strong>{' '}
                                                        <code className="bg-gray-200 px-1 rounded">{pathInfo.example}</code>
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1 mt-2">
                                                <span className="text-xs text-gray-500">Used by:</span>
                                                {pathInfo.usedBy.map(reg => (
                                                    <span
                                                        key={reg}
                                                        className={`px-1.5 py-0.5 text-xs rounded ${
                                                            reg === 'EMIR' ? 'bg-blue-100 text-blue-700' :
                                                            reg === 'MIFIR' ? 'bg-purple-100 text-purple-700' :
                                                            reg === 'SFTR' ? 'bg-green-100 text-green-700' :
                                                            'bg-gray-100 text-gray-700'
                                                        }`}
                                                    >
                                                        {reg}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    ) : null;
                                })()}

                                {/* Connector selection */}
                                <div>
                                    <label className="input-label">
                                        <Database className="w-4 h-4 inline mr-1" />
                                        Data Source
                                    </label>
                                    <select
                                        className="input"
                                        value={selectedConnector}
                                        onChange={e => {
                                            setSelectedConnector(e.target.value);
                                            setSelectedTable('');
                                            setEditingMapping(prev => prev ? {
                                                ...prev,
                                                connector_id: e.target.value || null,
                                                table_name: null,
                                                column_name: null
                                            } : null);
                                        }}
                                    >
                                        <option value="">Select a connector...</option>
                                        {connectors?.map((c: any) => (
                                            <option key={c.id} value={c.id}>{c.name} ({c.db_type})</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Table selection */}
                                {selectedConnector && (
                                    <div>
                                        <label className="input-label">
                                            <Table className="w-4 h-4 inline mr-1" />
                                            Table
                                        </label>
                                        <select
                                            className="input"
                                            value={selectedTable}
                                            onChange={e => {
                                                setSelectedTable(e.target.value);
                                                setEditingMapping(prev => prev ? {
                                                    ...prev,
                                                    table_name: e.target.value || null,
                                                    column_name: null
                                                } : null);
                                            }}
                                            disabled={tablesLoading}
                                        >
                                            <option value="">
                                                {tablesLoading ? 'Loading tables...' : 'Select a table...'}
                                            </option>
                                            {tables?.map((t: any) => (
                                                <option key={t.name || t} value={t.name || t}>
                                                    {t.name || t}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {/* Column selection */}
                                {selectedTable && (
                                    <div>
                                        <label className="input-label">
                                            <Columns className="w-4 h-4 inline mr-1" />
                                            Column
                                        </label>
                                        <select
                                            className="input"
                                            value={editingMapping?.column_name || ''}
                                            onChange={e => {
                                                setEditingMapping(prev => prev ? {
                                                    ...prev,
                                                    column_name: e.target.value || null
                                                } : null);
                                            }}
                                            disabled={columnsLoading}
                                        >
                                            <option value="">
                                                {columnsLoading ? 'Loading columns...' : 'Select a column...'}
                                            </option>
                                            {columns?.map((c: any) => (
                                                <option key={c.name || c} value={c.name || c}>
                                                    {c.name || c} {c.data_type ? `(${c.data_type})` : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {/* Transformation (optional) */}
                                {editingMapping?.column_name && (
                                    <div>
                                        <label className="input-label">Transformation (optional)</label>
                                        <input
                                            type="text"
                                            className="input font-mono text-sm"
                                            placeholder="e.g., UPPER(column) or column::text"
                                            value={editingMapping?.transformation || ''}
                                            onChange={e => {
                                                setEditingMapping(prev => prev ? {
                                                    ...prev,
                                                    transformation: e.target.value || null
                                                } : null);
                                            }}
                                        />
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="flex items-center gap-2 pt-2">
                                    <button
                                        onClick={saveMapping}
                                        disabled={!editingMapping?.connector_id || !editingMapping?.table_name || !editingMapping?.column_name}
                                        className="btn btn-primary flex-1"
                                    >
                                        Save Mapping
                                    </button>
                                    {getMapping(selectedPath) && (
                                        <button
                                            onClick={() => {
                                                deleteMapping(selectedPath);
                                                setSelectedPath(null);
                                                setEditingMapping(null);
                                            }}
                                            className="btn btn-ghost text-red-600"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-8 text-gray-500">
                                <Database className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <p>Select a CDM path to configure its data source</p>
                            </div>
                        )}
                    </div>

                    {/* Current mapping summary */}
                    {selectedPath && getMapping(selectedPath)?.column_name && (
                        <div className="card p-4 bg-green-50 border-green-200">
                            <h4 className="text-sm font-medium text-green-800 mb-2">Current Mapping</h4>
                            <div className="text-sm text-green-700 space-y-1">
                                <div><strong>Source:</strong> {getMapping(selectedPath)?.connector_name}</div>
                                <div><strong>Table:</strong> {getMapping(selectedPath)?.table_name}</div>
                                <div><strong>Column:</strong> {getMapping(selectedPath)?.column_name}</div>
                                {getMapping(selectedPath)?.transformation && (
                                    <div><strong>Transform:</strong> <code>{getMapping(selectedPath)?.transformation}</code></div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
