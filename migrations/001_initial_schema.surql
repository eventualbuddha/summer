-- Migration: 001_initial_schema
-- Description: Initial database schema
-- Date: 2026-02-15

DEFINE TABLE category SCHEMAFULL;
DEFINE FIELD name ON TABLE category TYPE string;
DEFINE FIELD ordinal ON TABLE category TYPE number DEFAULT ((SELECT ordinal FROM category).ordinal.max() ?? 0) + 1;
DEFINE FIELD color ON TABLE category TYPE string;
DEFINE FIELD emoji ON TABLE category TYPE string;
DEFINE INDEX categoryOrdinalIndex ON TABLE category COLUMNS ordinal UNIQUE;

DEFINE TABLE tag SCHEMAFULL;
DEFINE FIELD name ON TABLE tag TYPE string;
DEFINE INDEX tagNameIndex ON TABLE tag COLUMNS name UNIQUE;

DEFINE TABLE file SCHEMAFULL;
DEFINE FIELD name ON TABLE file TYPE string;
DEFINE FIELD data ON TABLE file TYPE bytes;

DEFINE TABLE account SCHEMAFULL;
DEFINE FIELD name ON TABLE account TYPE string;
DEFINE FIELD number ON TABLE account TYPE option<string>;
DEFINE FIELD source ON TABLE account TYPE option<string>;
DEFINE FIELD type ON TABLE account TYPE string;

DEFINE TABLE statement SCHEMAFULL;
DEFINE FIELD account ON TABLE statement TYPE record<account>;
DEFINE FIELD date ON TABLE statement TYPE datetime;
DEFINE FIELD file ON TABLE statement TYPE record<file>;
DEFINE INDEX statementAccountDateIndex ON TABLE statement COLUMNS account, date UNIQUE;

DEFINE TABLE transaction SCHEMAFULL;
DEFINE FIELD statement ON TABLE transaction TYPE record<statement>;
DEFINE FIELD date ON TABLE transaction TYPE datetime;
DEFINE FIELD amount ON TABLE transaction TYPE number;
DEFINE FIELD statementDescription ON TABLE transaction TYPE string;
DEFINE FIELD description ON TABLE transaction TYPE option<string>;
DEFINE FIELD category ON TABLE transaction TYPE option<record<category>>;
DEFINE FIELD type ON TABLE transaction TYPE string;
DEFINE INDEX transactionDateIndex ON TABLE transaction COLUMNS date;
DEFINE INDEX transactionCategoryIndex ON TABLE transaction COLUMNS category;
DEFINE INDEX transactionDateCategoryIndex ON TABLE transaction COLUMNS date, category;
DEFINE INDEX transactionStatementDateIndex ON TABLE transaction COLUMNS statement.date;
DEFINE INDEX transactionStatementDateCategoryIndex ON TABLE transaction COLUMNS statement.date, category;

DEFINE TABLE tagged SCHEMAFULL TYPE RELATION IN transaction OUT tag;
DEFINE FIELD year ON TABLE tagged TYPE option<number>;

DEFINE TABLE budget SCHEMAFULL;
DEFINE FIELD name ON TABLE budget TYPE string;
DEFINE FIELD year ON TABLE budget TYPE number;
DEFINE FIELD amount ON TABLE budget TYPE number;
DEFINE FIELD categories ON TABLE budget TYPE array<record<category>>;
DEFINE INDEX budgetNameIndex ON TABLE budget COLUMNS name;
DEFINE INDEX budgetNameYearIndex ON TABLE budget COLUMNS name, year;

DEFINE TABLE settings SCHEMAFULL;
DEFINE FIELD defaultCategory ON TABLE settings TYPE option<record<category>>;
