/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/workspace.json`.
 */
export type Workspace = {
  "address": "CsQC1gyKSdxJo4P9e6iaXgEwgwTw3kZYyiv89yzGZnXX",
  "metadata": {
    "name": "workspace",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "addPaymentMint",
      "discriminator": [
        122,
        149,
        9,
        186,
        21,
        201,
        60,
        241
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "authority"
              }
            ]
          }
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "mint"
        },
        {
          "name": "treasuryAta"
        },
        {
          "name": "paymentMint",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  105,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "decimals",
          "type": "u8"
        }
      ]
    },
    {
      "name": "closePass",
      "discriminator": [
        165,
        74,
        197,
        223,
        61,
        96,
        167,
        201
      ],
      "accounts": [
        {
          "name": "pass",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  115,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "owner",
          "writable": true,
          "signer": true,
          "relations": [
            "pass"
          ]
        }
      ],
      "args": []
    },
    {
      "name": "initializeConfig",
      "discriminator": [
        208,
        127,
        21,
        1,
        194,
        190,
        196,
        70
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "authority"
              }
            ]
          }
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "treasury",
          "type": "pubkey"
        },
        {
          "name": "tier0PriceLamports",
          "type": "u64"
        },
        {
          "name": "tier0PriceToken",
          "type": "u64"
        },
        {
          "name": "tier1PriceLamports",
          "type": "u64"
        },
        {
          "name": "tier1PriceToken",
          "type": "u64"
        }
      ]
    },
    {
      "name": "purchasePassSol",
      "discriminator": [
        96,
        62,
        78,
        241,
        174,
        245,
        194,
        19
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "config.authority",
                "account": "config"
              }
            ]
          }
        },
        {
          "name": "buyer",
          "writable": true,
          "signer": true
        },
        {
          "name": "treasury",
          "writable": true
        },
        {
          "name": "pass",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  115,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "buyer"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "tier",
          "type": "u8"
        }
      ]
    },
    {
      "name": "purchasePassToken",
      "discriminator": [
        119,
        226,
        53,
        124,
        230,
        169,
        250,
        40
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "config.authority",
                "account": "config"
              }
            ]
          }
        },
        {
          "name": "buyer",
          "writable": true,
          "signer": true
        },
        {
          "name": "buyerAta",
          "writable": true
        },
        {
          "name": "paymentMint",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  105,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "buyer_ata.mint",
                "account": "tokenAccount"
              }
            ]
          }
        },
        {
          "name": "treasuryAta",
          "writable": true
        },
        {
          "name": "pass",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  115,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "buyer"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "tier",
          "type": "u8"
        }
      ]
    },
    {
      "name": "setPaymentMintActive",
      "discriminator": [
        117,
        68,
        143,
        140,
        57,
        208,
        242,
        179
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "authority"
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "mint"
        },
        {
          "name": "paymentMint",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  105,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "active",
          "type": "bool"
        }
      ]
    },
    {
      "name": "setTierPrice",
      "discriminator": [
        255,
        96,
        63,
        105,
        60,
        20,
        221,
        97
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "authority"
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "config"
          ]
        }
      ],
      "args": [
        {
          "name": "tier",
          "type": "u8"
        },
        {
          "name": "priceLamports",
          "type": "u64"
        },
        {
          "name": "priceTokenBaseUnits",
          "type": "u64"
        },
        {
          "name": "active",
          "type": "bool"
        }
      ]
    },
    {
      "name": "updateConfig",
      "discriminator": [
        29,
        158,
        252,
        191,
        10,
        83,
        219,
        99
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "authority"
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "config"
          ]
        }
      ],
      "args": [
        {
          "name": "treasury",
          "type": {
            "option": "pubkey"
          }
        },
        {
          "name": "paused",
          "type": {
            "option": "bool"
          }
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "config",
      "discriminator": [
        155,
        12,
        170,
        224,
        30,
        250,
        204,
        130
      ]
    },
    {
      "name": "pass",
      "discriminator": [
        40,
        247,
        140,
        113,
        56,
        14,
        57,
        44
      ]
    },
    {
      "name": "paymentMint",
      "discriminator": [
        234,
        73,
        102,
        104,
        105,
        211,
        251,
        238
      ]
    }
  ],
  "events": [
    {
      "name": "passPurchased",
      "discriminator": [
        11,
        171,
        162,
        118,
        129,
        168,
        151,
        90
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "paused",
      "msg": "Program is paused"
    },
    {
      "code": 6001,
      "name": "invalidTier",
      "msg": "Invalid tier"
    },
    {
      "code": 6002,
      "name": "tierInactive",
      "msg": "Tier is inactive"
    },
    {
      "code": 6003,
      "name": "mintNotWhitelisted",
      "msg": "Mint is not whitelisted"
    },
    {
      "code": 6004,
      "name": "mintInactive",
      "msg": "Mint is inactive"
    },
    {
      "code": 6005,
      "name": "invalidMint",
      "msg": "Invalid mint account"
    },
    {
      "code": 6006,
      "name": "invalidTreasury",
      "msg": "Invalid treasury account"
    },
    {
      "code": 6007,
      "name": "invalidMintDecimals",
      "msg": "Invalid mint decimals"
    },
    {
      "code": 6008,
      "name": "passStillActive",
      "msg": "Pass is still active"
    },
    {
      "code": 6009,
      "name": "mathOverflow",
      "msg": "Math overflow occurred"
    },
    {
      "code": 6010,
      "name": "unauthorized",
      "msg": "Unauthorized access"
    },
    {
      "code": 6011,
      "name": "configInactive",
      "msg": "Config is inactive"
    },
    {
      "code": 6012,
      "name": "invalidConfig",
      "msg": "Pass belongs to a different config"
    }
  ],
  "types": [
    {
      "name": "config",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "treasury",
            "type": "pubkey"
          },
          {
            "name": "isActive",
            "type": "bool"
          },
          {
            "name": "isPaused",
            "type": "bool"
          },
          {
            "name": "version",
            "type": "u8"
          },
          {
            "name": "tierCount",
            "type": "u8"
          },
          {
            "name": "tiers",
            "type": {
              "array": [
                {
                  "defined": {
                    "name": "tierConfig"
                  }
                },
                2
              ]
            }
          }
        ]
      }
    },
    {
      "name": "pass",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "config",
            "type": "pubkey"
          },
          {
            "name": "tier",
            "type": "u8"
          },
          {
            "name": "expiresAt",
            "type": "i64"
          },
          {
            "name": "lastPurchaseAt",
            "type": "i64"
          },
          {
            "name": "totalPurchases",
            "type": "u32"
          }
        ]
      }
    },
    {
      "name": "passPurchased",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "config",
            "type": "pubkey"
          },
          {
            "name": "tier",
            "type": "u8"
          },
          {
            "name": "expiresAt",
            "type": "i64"
          },
          {
            "name": "purchasedAt",
            "type": "i64"
          },
          {
            "name": "totalPurchases",
            "type": "u32"
          },
          {
            "name": "paidInSol",
            "type": "bool"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "paymentMint",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "config",
            "type": "pubkey"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "treasuryAta",
            "type": "pubkey"
          },
          {
            "name": "decimals",
            "type": "u8"
          },
          {
            "name": "active",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "tierConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "durationSeconds",
            "type": "i64"
          },
          {
            "name": "priceLamports",
            "type": "u64"
          },
          {
            "name": "priceTokenBaseUnits",
            "type": "u64"
          },
          {
            "name": "active",
            "type": "bool"
          }
        ]
      }
    }
  ]
};
