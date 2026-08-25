use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("CsQC1gyKSdxJo4P9e6iaXgEwgwTw3kZYyiv89yzGZnXX");

pub const TIER_COUNT: usize = 2;
pub const TIER_SENTINEL_DURATION: i64 = 604_800;
pub const TIER_ORACLE_DURATION: i64 = 2_592_000;
pub const TIER_DURATIONS: [i64; TIER_COUNT] = [TIER_SENTINEL_DURATION, TIER_ORACLE_DURATION];

pub fn is_pass_valid(pass: &Pass, now: i64) -> bool {
    pass.expires_at > now
}

#[program]
pub mod workspace {
    use super::*;

    // treasury: Pubkey, SOL payment destination wallet, 9PJ8I...3555
    // tier0_price_lamports: u64, Sentinel 7-day price in lamports, 50000000 = 0.05 SOL
    // tier0_price_token: u64, Sentinel 7-day price in token base units, 5000000 = 5 USDC
    // tier1_price_lamports: u64, Oracle 30-day price in lamports, 150000000 = 0.15 SOL
    // tier1_price_token: u64, Oracle 30-day price in token base units, 15000000 = 15 USDC
    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        treasury: Pubkey,
        tier0_price_lamports: u64,
        tier0_price_token: u64,
        tier1_price_lamports: u64,
        tier1_price_token: u64,
    ) -> Result<()> {
        require!(treasury != Pubkey::default(), ErrorCode::InvalidTreasury);

        let config = &mut ctx.accounts.config;
        config.bump = ctx.bumps.config;
        config.authority = ctx.accounts.authority.key();
        config.treasury = treasury;
        config.is_active = true;
        config.is_paused = false;
        config.version = 1;
        config.tier_count = TIER_COUNT as u8;
        config.tiers = [
            TierConfig {
                duration_seconds: TIER_DURATIONS[0],
                price_lamports: tier0_price_lamports,
                price_token_base_units: tier0_price_token,
                active: true,
            },
            TierConfig {
                duration_seconds: TIER_DURATIONS[1],
                price_lamports: tier1_price_lamports,
                price_token_base_units: tier1_price_token,
                active: true,
            },
        ];
        Ok(())
    }

    pub fn update_config(
        ctx: Context<UpdateConfig>,
        treasury: Option<Pubkey>,
        paused: Option<bool>,
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;

        if let Some(new_treasury) = treasury {
            require!(new_treasury != Pubkey::default(), ErrorCode::InvalidTreasury);
            config.treasury = new_treasury;
        }
        if let Some(new_paused) = paused {
            config.is_paused = new_paused;
        }
        Ok(())
    }

    pub fn set_tier_price(
        ctx: Context<UpdateConfig>,
        tier: u8,
        price_lamports: u64,
        price_token_base_units: u64,
        active: bool,
    ) -> Result<()> {
        let index = tier as usize;
        require!(index < TIER_COUNT, ErrorCode::InvalidTier);

        let config = &mut ctx.accounts.config;
        let slot = &mut config.tiers[index];
        slot.duration_seconds = TIER_DURATIONS[index];
        slot.price_lamports = price_lamports;
        slot.price_token_base_units = price_token_base_units;
        slot.active = active;
        Ok(())
    }

    pub fn add_payment_mint(ctx: Context<AddPaymentMint>, decimals: u8) -> Result<()> {
        let mint_key = ctx.accounts.mint.key();
        let config_key = ctx.accounts.config.key();

        require!(
            ctx.accounts.mint.decimals == decimals,
            ErrorCode::InvalidMintDecimals
        );
        require!(
            ctx.accounts.treasury_ata.mint == mint_key,
            ErrorCode::InvalidMint
        );

        let payment_mint = &mut ctx.accounts.payment_mint;
        payment_mint.bump = ctx.bumps.payment_mint;
        payment_mint.config = config_key;
        payment_mint.mint = mint_key;
        payment_mint.treasury_ata = ctx.accounts.treasury_ata.key();
        payment_mint.decimals = decimals;
        payment_mint.active = true;
        Ok(())
    }

    pub fn set_payment_mint_active(ctx: Context<SetPaymentMintActive>, active: bool) -> Result<()> {
        let payment_mint = &mut ctx.accounts.payment_mint;
        payment_mint.active = active;
        Ok(())
    }

    pub fn purchase_pass_sol(ctx: Context<PurchasePassSol>, tier: u8) -> Result<()> {
        let config = &ctx.accounts.config;
        let config_key = config.key();
        let buyer_key = ctx.accounts.buyer.key();
        let index = tier as usize;

        require!(config.is_active, ErrorCode::ConfigInactive);
        require!(!config.is_paused, ErrorCode::Paused);
        require!(index < TIER_COUNT, ErrorCode::InvalidTier);

        let tier_config = config.tiers[index];
        require!(tier_config.active, ErrorCode::TierInactive);

        let existing_config = ctx.accounts.pass.config;
        require!(
            existing_config == Pubkey::default() || existing_config == config_key,
            ErrorCode::InvalidConfig
        );

        let now = Clock::get()?.unix_timestamp;
        let price = tier_config.price_lamports;

        if price > 0 {
            anchor_lang::system_program::transfer(
                CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    anchor_lang::system_program::Transfer {
                        from: ctx.accounts.buyer.to_account_info(),
                        to: ctx.accounts.treasury.to_account_info(),
                    },
                ),
                price,
            )?;
        }

        let pass_bump = ctx.bumps.pass;
        let pass = &mut ctx.accounts.pass;
        pass.bump = pass_bump;
        pass.owner = buyer_key;
        pass.config = config_key;
        pass.apply_purchase(tier, tier_config.duration_seconds, now)?;

        emit!(PassPurchased {
            owner: buyer_key,
            config: config_key,
            tier: pass.tier,
            expires_at: pass.expires_at,
            purchased_at: now,
            total_purchases: pass.total_purchases,
            paid_in_sol: true,
            amount: price,
        });
        Ok(())
    }

    pub fn purchase_pass_token(ctx: Context<PurchasePassToken>, tier: u8) -> Result<()> {
        let config = &ctx.accounts.config;
        let config_key = config.key();
        let buyer_key = ctx.accounts.buyer.key();
        let index = tier as usize;

        require!(config.is_active, ErrorCode::ConfigInactive);
        require!(!config.is_paused, ErrorCode::Paused);
        require!(index < TIER_COUNT, ErrorCode::InvalidTier);

        let tier_config = config.tiers[index];
        require!(tier_config.active, ErrorCode::TierInactive);

        let existing_config = ctx.accounts.pass.config;
        require!(
            existing_config == Pubkey::default() || existing_config == config_key,
            ErrorCode::InvalidConfig
        );

        let now = Clock::get()?.unix_timestamp;
        let price = tier_config.price_token_base_units;

        if price > 0 {
            token::transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.buyer_ata.to_account_info(),
                        to: ctx.accounts.treasury_ata.to_account_info(),
                        authority: ctx.accounts.buyer.to_account_info(),
                    },
                ),
                price,
            )?;
        }

        let pass_bump = ctx.bumps.pass;
        let pass = &mut ctx.accounts.pass;
        pass.bump = pass_bump;
        pass.owner = buyer_key;
        pass.config = config_key;
        pass.apply_purchase(tier, tier_config.duration_seconds, now)?;

        emit!(PassPurchased {
            owner: buyer_key,
            config: config_key,
            tier: pass.tier,
            expires_at: pass.expires_at,
            purchased_at: now,
            total_purchases: pass.total_purchases,
            paid_in_sol: false,
            amount: price,
        });
        Ok(())
    }

    pub fn close_pass(ctx: Context<ClosePass>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        require!(
            ctx.accounts.pass.owner == ctx.accounts.owner.key(),
            ErrorCode::Unauthorized
        );
        require!(
            !is_pass_valid(&ctx.accounts.pass, now),
            ErrorCode::PassStillActive
        );
        Ok(())
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct TierConfig {
    pub duration_seconds: i64,
    pub price_lamports: u64,
    pub price_token_base_units: u64,
    pub active: bool,
}

impl TierConfig {
    pub const LEN: usize = 8 + 8 + 8 + 1;
}

#[account]
pub struct Config {
    pub bump: u8,
    pub authority: Pubkey,
    pub treasury: Pubkey,
    pub is_active: bool,
    pub is_paused: bool,
    pub version: u8,
    pub tier_count: u8,
    pub tiers: [TierConfig; TIER_COUNT],
}

impl Config {
    pub const LEN: usize = 1 + 32 + 32 + 1 + 1 + 1 + 1 + (TierConfig::LEN * TIER_COUNT);
}

#[account]
pub struct PaymentMint {
    pub bump: u8,
    pub config: Pubkey,
    pub mint: Pubkey,
    pub treasury_ata: Pubkey,
    pub decimals: u8,
    pub active: bool,
}

impl PaymentMint {
    pub const LEN: usize = 1 + 32 + 32 + 32 + 1 + 1;
}

#[account]
pub struct Pass {
    pub bump: u8,
    pub owner: Pubkey,
    pub config: Pubkey,
    pub tier: u8,
    pub expires_at: i64,
    pub last_purchase_at: i64,
    pub total_purchases: u32,
}

impl Pass {
    pub const LEN: usize = 1 + 32 + 32 + 1 + 8 + 8 + 4;

    pub fn is_valid(&self, now: i64) -> bool {
        is_pass_valid(self, now)
    }

    pub fn apply_purchase(&mut self, tier: u8, duration_seconds: i64, now: i64) -> Result<()> {
        let base = if self.is_valid(now) {
            self.expires_at
        } else {
            now
        };

        self.expires_at = base
            .checked_add(duration_seconds)
            .ok_or(ErrorCode::MathOverflow)?;
        self.tier = tier;
        self.last_purchase_at = now;
        self.total_purchases = self
            .total_purchases
            .checked_add(1)
            .ok_or(ErrorCode::MathOverflow)?;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(
        init,
        seeds = [b"config", authority.key().as_ref()],
        bump,
        payer = authority,
        space = 8 + Config::LEN
    )]
    pub config: Account<'info, Config>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    #[account(
        mut,
        seeds = [b"config", authority.key().as_ref()],
        bump = config.bump,
        has_one = authority @ ErrorCode::Unauthorized,
    )]
    pub config: Account<'info, Config>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct AddPaymentMint<'info> {
    #[account(
        seeds = [b"config", authority.key().as_ref()],
        bump = config.bump,
        has_one = authority @ ErrorCode::Unauthorized,
    )]
    pub config: Account<'info, Config>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub mint: Account<'info, Mint>,

    #[account(constraint = treasury_ata.mint == mint.key() @ ErrorCode::InvalidMint)]
    pub treasury_ata: Account<'info, TokenAccount>,

    #[account(
        init,
        seeds = [b"mint", mint.key().as_ref()],
        bump,
        payer = authority,
        space = 8 + PaymentMint::LEN
    )]
    pub payment_mint: Account<'info, PaymentMint>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetPaymentMintActive<'info> {
    #[account(
        seeds = [b"config", authority.key().as_ref()],
        bump = config.bump,
        has_one = authority @ ErrorCode::Unauthorized,
    )]
    pub config: Account<'info, Config>,

    pub authority: Signer<'info>,

    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [b"mint", mint.key().as_ref()],
        bump = payment_mint.bump,
        constraint = payment_mint.config == config.key() @ ErrorCode::MintNotWhitelisted,
        constraint = payment_mint.mint == mint.key() @ ErrorCode::InvalidMint,
    )]
    pub payment_mint: Account<'info, PaymentMint>,
}

#[derive(Accounts)]
pub struct PurchasePassSol<'info> {
    #[account(
        seeds = [b"config", config.authority.as_ref()],
        bump = config.bump,
    )]
    pub config: Account<'info, Config>,

    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(
        mut,
        constraint = treasury.key() == config.treasury @ ErrorCode::InvalidTreasury,
    )]
    pub treasury: SystemAccount<'info>,

    #[account(
        init_if_needed,
        seeds = [b"pass", buyer.key().as_ref()],
        bump,
        payer = buyer,
        space = 8 + Pass::LEN
    )]
    pub pass: Account<'info, Pass>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PurchasePassToken<'info> {
    #[account(
        seeds = [b"config", config.authority.as_ref()],
        bump = config.bump,
    )]
    pub config: Account<'info, Config>,

    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(
        mut,
        constraint = buyer_ata.owner == buyer.key() @ ErrorCode::Unauthorized,
        constraint = buyer_ata.mint == payment_mint.mint @ ErrorCode::InvalidMint,
    )]
    pub buyer_ata: Account<'info, TokenAccount>,

    #[account(
        seeds = [b"mint", buyer_ata.mint.as_ref()],
        bump = payment_mint.bump,
        constraint = payment_mint.config == config.key() @ ErrorCode::MintNotWhitelisted,
        constraint = payment_mint.active @ ErrorCode::MintInactive,
    )]
    pub payment_mint: Account<'info, PaymentMint>,

    #[account(
        mut,
        constraint = treasury_ata.key() == payment_mint.treasury_ata @ ErrorCode::InvalidTreasury,
        constraint = treasury_ata.mint == payment_mint.mint @ ErrorCode::InvalidMint,
    )]
    pub treasury_ata: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        seeds = [b"pass", buyer.key().as_ref()],
        bump,
        payer = buyer,
        space = 8 + Pass::LEN
    )]
    pub pass: Account<'info, Pass>,

    pub token_program: Program<'info, Token>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClosePass<'info> {
    #[account(
        mut,
        seeds = [b"pass", owner.key().as_ref()],
        bump = pass.bump,
        has_one = owner @ ErrorCode::Unauthorized,
        close = owner,
    )]
    pub pass: Account<'info, Pass>,

    #[account(mut)]
    pub owner: Signer<'info>,
}

#[event]
pub struct PassPurchased {
    pub owner: Pubkey,
    pub config: Pubkey,
    pub tier: u8,
    pub expires_at: i64,
    pub purchased_at: i64,
    pub total_purchases: u32,
    pub paid_in_sol: bool,
    pub amount: u64,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Program is paused")]
    Paused,
    #[msg("Invalid tier")]
    InvalidTier,
    #[msg("Tier is inactive")]
    TierInactive,
    #[msg("Mint is not whitelisted")]
    MintNotWhitelisted,
    #[msg("Mint is inactive")]
    MintInactive,
    #[msg("Invalid mint account")]
    InvalidMint,
    #[msg("Invalid treasury account")]
    InvalidTreasury,
    #[msg("Invalid mint decimals")]
    InvalidMintDecimals,
    #[msg("Pass is still active")]
    PassStillActive,
    #[msg("Math overflow occurred")]
    MathOverflow,
    #[msg("Unauthorized access")]
    Unauthorized,
    #[msg("Config is inactive")]
    ConfigInactive,
    #[msg("Pass belongs to a different config")]
    InvalidConfig,
}
