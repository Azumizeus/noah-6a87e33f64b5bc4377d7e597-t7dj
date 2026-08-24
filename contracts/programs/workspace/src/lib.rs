use anchor_lang::prelude::*;

declare_id!("CsQC1gyKSdxJo4P9e6iaXgEwgwTw3kZYyiv89yzGZnXX");

#[program]
pub mod workspace {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
