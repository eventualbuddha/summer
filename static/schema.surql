REMOVE TABLE IF EXISTS attached;
REMOVE TABLE IF EXISTS tagged;

REMOVE TABLE IF EXISTS category;
DEFINE TABLE category SCHEMAFULL;
DEFINE FIELD name ON TABLE category TYPE string;
DEFINE FIELD ordinal ON TABLE category TYPE number DEFAULT ((SELECT ordinal FROM category).ordinal.max() ?? 0) + 1;
DEFINE FIELD color ON TABLE category TYPE string;
DEFINE FIELD emoji ON TABLE category TYPE string;
DEFINE INDEX categoryOrdinalIndex ON TABLE category COLUMNS ordinal UNIQUE;

REMOVE TABLE IF EXISTS tag;
DEFINE TABLE tag SCHEMAFULL;
DEFINE FIELD name ON TABLE tag TYPE string;

REMOVE TABLE IF EXISTS file;
DEFINE TABLE file SCHEMAFULL;
DEFINE FIELD name ON TABLE file TYPE string;
DEFINE FIELD data ON TABLE file TYPE bytes;

REMOVE TABLE IF EXISTS account;
DEFINE TABLE account SCHEMAFULL;
DEFINE FIELD name ON TABLE account TYPE string;
DEFINE FIELD number ON TABLE account TYPE option<string>;
DEFINE FIELD source ON TABLE account TYPE option<string>;
DEFINE FIELD type ON TABLE account TYPE string;

REMOVE TABLE IF EXISTS statement;
DEFINE TABLE statement SCHEMAFULL;
DEFINE FIELD account ON TABLE statement TYPE record<account>;
DEFINE FIELD date ON TABLE statement TYPE datetime;
DEFINE FIELD file ON TABLE statement TYPE record<file>;

REMOVE TABLE IF EXISTS transaction;
DEFINE TABLE transaction SCHEMAFULL;
DEFINE FIELD statement ON TABLE transaction TYPE record<statement>;
DEFINE FIELD date ON TABLE transaction TYPE datetime;
DEFINE FIELD amount ON TABLE transaction TYPE number;
DEFINE FIELD statementDescription ON TABLE transaction TYPE string;
DEFINE FIELD description ON TABLE transaction TYPE option<string>;
DEFINE FIELD category ON TABLE transaction TYPE option<record<category>>;
DEFINE FIELD type ON TABLE transaction TYPE string;

REMOVE TABLE IF EXISTS settings;
DEFINE TABLE settings SCHEMAFULL;
DEFINE FIELD defaultCategory ON TABLE settings TYPE option<record<category>>;
CREATE settings:global;
