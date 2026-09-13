import { expect } from "chai";
import { ethers } from "hardhat";
import { ZIP0PaymentVault, MockUSDC } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

async function increaseTime(seconds: number) {
  await ethers.provider.send("evm_increaseTime", [seconds]);
  await ethers.provider.send("evm_mine", []);
}

describe("ZIP0PaymentVault", function () {
  let vault: ZIP0PaymentVault;
  let usdc: MockUSDC;
  let admin: HardhatEthersSigner;
  let relayer: HardhatEthersSigner;
  let user: HardhatEthersSigner;
  let merchant: HardhatEthersSigner;

  const STELLAR_DOMAIN = 21;
  const MOCK_RECIPIENT_BYTES = ethers.encodeBytes32String("G...STELLAR_ADDR");

  beforeEach(async function () {
    [admin, relayer, user, merchant] = await ethers.getSigners();

    const MockUSDCFactory = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDCFactory.deploy();
    await usdc.waitForDeployment();

    const VaultFactory = await ethers.getContractFactory("ZIP0PaymentVault");
    vault = await VaultFactory.deploy(
      await usdc.getAddress(),
      admin.address,
      relayer.address
    );
    await vault.waitForDeployment();

    // Fund user with 1,000 USDC (6 decimals)
    await usdc.mint(user.address, ethers.parseUnits("1000", 6));
  });

  describe("Initialization", function () {
    it("should set correct roles and USDC token", async function () {
      expect(await vault.usdcToken()).to.equal(await usdc.getAddress());

      const RELAYER_ROLE = await vault.RELAYER_ROLE();
      const TREASURY_ROLE = await vault.TREASURY_ROLE();
      const DEFAULT_ADMIN_ROLE = await vault.DEFAULT_ADMIN_ROLE();

      expect(await vault.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.be.true;
      expect(await vault.hasRole(TREASURY_ROLE, admin.address)).to.be.true;
      expect(await vault.hasRole(RELAYER_ROLE, relayer.address)).to.be.true;
      expect(await vault.hasRole(RELAYER_ROLE, user.address)).to.be.false;
    });
  });

  describe("depositPayment", function () {
    it("should deposit USDC and emit PaymentInitiated", async function () {
      const amount = ethers.parseUnits("50", 6);
      const paymentId = ethers.keccak256(ethers.toUtf8Bytes("payment-001"));
      const metadata = ethers.toUtf8Bytes(JSON.stringify({ orderId: "ord-123" }));

      await usdc.connect(user).approve(await vault.getAddress(), amount);

      await expect(
        vault
          .connect(user)
          .depositPayment(
            paymentId,
            amount,
            STELLAR_DOMAIN,
            MOCK_RECIPIENT_BYTES,
            metadata
          )
      )
        .to.emit(vault, "PaymentInitiated")
        .withArgs(
          paymentId,
          user.address,
          amount,
          STELLAR_DOMAIN,
          MOCK_RECIPIENT_BYTES,
          ethers.hexlify(metadata)
        );

      expect(await usdc.balanceOf(await vault.getAddress())).to.equal(amount);

      const payment = await vault.payments(paymentId);
      expect(payment.payer).to.equal(user.address);
      expect(payment.amount).to.equal(amount);
      expect(payment.status).to.equal(1); // INITIATED
    });

    it("should revert if paymentId already exists", async function () {
      const amount = ethers.parseUnits("10", 6);
      const paymentId = ethers.keccak256(ethers.toUtf8Bytes("duplicate-id"));

      await usdc.connect(user).approve(await vault.getAddress(), amount * 2n);

      await vault
        .connect(user)
        .depositPayment(
          paymentId,
          amount,
          STELLAR_DOMAIN,
          MOCK_RECIPIENT_BYTES,
          "0x"
        );

      await expect(
        vault
          .connect(user)
          .depositPayment(
            paymentId,
            amount,
            STELLAR_DOMAIN,
            MOCK_RECIPIENT_BYTES,
            "0x"
          )
      ).to.be.revertedWith("Payment already exists");
    });
  });

  describe("depositWithPermit", function () {
    it("should allow single-transaction gasless permit deposit", async function () {
      const amount = ethers.parseUnits("100", 6);
      const paymentId = ethers.keccak256(ethers.toUtf8Bytes("permit-payment-001"));
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      const nonce = await usdc.nonces(user.address);
      const usdcAddress = await usdc.getAddress();
      const vaultAddress = await vault.getAddress();
      const network = await ethers.provider.getNetwork();

      const domain = {
        name: "USD Coin",
        version: "1",
        chainId: network.chainId,
        verifyingContract: usdcAddress,
      };

      const types = {
        Permit: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
          { name: "value", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      };

      const values = {
        owner: user.address,
        spender: vaultAddress,
        value: amount,
        nonce: nonce,
        deadline: deadline,
      };

      const signature = await user.signTypedData(domain, types, values);
      const sig = ethers.Signature.from(signature);

      await expect(
        vault
          .connect(user)
          .depositWithPermit(
            paymentId,
            amount,
            STELLAR_DOMAIN,
            MOCK_RECIPIENT_BYTES,
            "0x",
            deadline,
            sig.v,
            sig.r,
            sig.s
          )
      )
        .to.emit(vault, "PaymentInitiated")
        .withArgs(
          paymentId,
          user.address,
          amount,
          STELLAR_DOMAIN,
          MOCK_RECIPIENT_BYTES,
          "0x"
        );

      expect(await usdc.balanceOf(vaultAddress)).to.equal(amount);
    });
  });

  describe("depositWithAuthorization (ERC-3009)", function () {
    const TYPES = {
      TransferWithAuthorization: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "validAfter", type: "uint256" },
        { name: "validBefore", type: "uint256" },
        { name: "nonce", type: "bytes32" },
      ],
    };

    async function signAuthorization(
      signer: HardhatEthersSigner,
      value: bigint,
      validAfter: number,
      validBefore: number,
      nonce: string
    ) {
      const network = await ethers.provider.getNetwork();
      const signature = await signer.signTypedData(
        {
          name: "USD Coin",
          version: "2",
          chainId: network.chainId,
          verifyingContract: await usdc.getAddress(),
        },
        TYPES,
        {
          from: signer.address,
          to: await vault.getAddress(),
          value,
          validAfter,
          validBefore,
          nonce,
        }
      );
      return ethers.Signature.from(signature);
    }

    it("accepts a valid authorization and needs no prior approval", async function () {
      const amount = ethers.parseUnits("25", 6);
      const paymentId = ethers.keccak256(ethers.toUtf8Bytes("auth-payment-001"));
      const nonce = ethers.hexlify(ethers.randomBytes(32));
      const now = (await ethers.provider.getBlock("latest"))!.timestamp;
      const validAfter = now - 1;
      const validBefore = now + 3600;

      const sig = await signAuthorization(user, amount, validAfter, validBefore, nonce);
      const vaultAddress = await vault.getAddress();

      expect(await usdc.allowance(user.address, vaultAddress)).to.equal(0n);

      await expect(
        vault
          .connect(user)
          .depositWithAuthorization(
            paymentId,
            amount,
            STELLAR_DOMAIN,
            MOCK_RECIPIENT_BYTES,
            "0x",
            validAfter,
            validBefore,
            nonce,
            sig.v,
            sig.r,
            sig.s
          )
      )
        .to.emit(vault, "PaymentInitiated")
        .withArgs(
          paymentId,
          user.address,
          amount,
          STELLAR_DOMAIN,
          MOCK_RECIPIENT_BYTES,
          "0x"
        );

      expect(await usdc.balanceOf(vaultAddress)).to.equal(amount);
      expect(await usdc.authorizationState(user.address, nonce)).to.equal(true);

      const payment = await vault.payments(paymentId);
      expect(payment.status).to.equal(1); // INITIATED
    });

    it("rejects an expired authorization", async function () {
      const amount = ethers.parseUnits("25", 6);
      const paymentId = ethers.keccak256(ethers.toUtf8Bytes("auth-expired"));
      const nonce = ethers.hexlify(ethers.randomBytes(32));
      const now = (await ethers.provider.getBlock("latest"))!.timestamp;
      const validAfter = now - 7200;
      const validBefore = now - 1;

      const sig = await signAuthorization(user, amount, validAfter, validBefore, nonce);

      await expect(
        vault
          .connect(user)
          .depositWithAuthorization(
            paymentId,
            amount,
            STELLAR_DOMAIN,
            MOCK_RECIPIENT_BYTES,
            "0x",
            validAfter,
            validBefore,
            nonce,
            sig.v,
            sig.r,
            sig.s
          )
      ).to.be.revertedWith("Authorization expired");
    });

    it("rejects an authorization that is not yet valid", async function () {
      const amount = ethers.parseUnits("25", 6);
      const paymentId = ethers.keccak256(ethers.toUtf8Bytes("auth-future"));
      const nonce = ethers.hexlify(ethers.randomBytes(32));
      const now = (await ethers.provider.getBlock("latest"))!.timestamp;
      const validAfter = now + 3600;
      const validBefore = now + 7200;

      const sig = await signAuthorization(user, amount, validAfter, validBefore, nonce);

      await expect(
        vault
          .connect(user)
          .depositWithAuthorization(
            paymentId,
            amount,
            STELLAR_DOMAIN,
            MOCK_RECIPIENT_BYTES,
            "0x",
            validAfter,
            validBefore,
            nonce,
            sig.v,
            sig.r,
            sig.s
          )
      ).to.be.revertedWith("Authorization not yet valid");
    });

    it("rejects a replayed nonce", async function () {
      const amount = ethers.parseUnits("25", 6);
      const nonce = ethers.hexlify(ethers.randomBytes(32));
      const now = (await ethers.provider.getBlock("latest"))!.timestamp;
      const validAfter = now - 1;
      const validBefore = now + 3600;

      const sig = await signAuthorization(user, amount, validAfter, validBefore, nonce);

      await vault
        .connect(user)
        .depositWithAuthorization(
          ethers.keccak256(ethers.toUtf8Bytes("auth-replay-1")),
          amount,
          STELLAR_DOMAIN,
          MOCK_RECIPIENT_BYTES,
          "0x",
          validAfter,
          validBefore,
          nonce,
          sig.v,
          sig.r,
          sig.s
        );

      await expect(
        vault
          .connect(user)
          .depositWithAuthorization(
            ethers.keccak256(ethers.toUtf8Bytes("auth-replay-2")),
            amount,
            STELLAR_DOMAIN,
            MOCK_RECIPIENT_BYTES,
            "0x",
            validAfter,
            validBefore,
            nonce,
            sig.v,
            sig.r,
            sig.s
          )
      ).to.be.revertedWith("Authorization already used");
    });
  });

  describe("releasePayment", function () {
    beforeEach(async function () {
      // Seed vault with initial 500 USDC
      await usdc.mint(await vault.getAddress(), ethers.parseUnits("500", 6));
    });

    it("should allow relayer to release funds to merchant in HSK", async function () {
      const amount = ethers.parseUnits("75", 6);
      const paymentId = ethers.keccak256(ethers.toUtf8Bytes("settle-hsk-001"));

      const merchantBalanceBefore = await usdc.balanceOf(merchant.address);

      await expect(
        vault.connect(relayer).releasePayment(paymentId, merchant.address, amount)
      )
        .to.emit(vault, "PaymentReleased")
        .withArgs(paymentId, merchant.address, amount, relayer.address);

      const merchantBalanceAfter = await usdc.balanceOf(merchant.address);
      expect(merchantBalanceAfter - merchantBalanceBefore).to.equal(amount);

      const payment = await vault.payments(paymentId);
      expect(payment.recipient).to.equal(merchant.address);
      expect(payment.status).to.equal(2); // RELEASED
    });

    it("should revert if called by non-relayer", async function () {
      const amount = ethers.parseUnits("10", 6);
      const paymentId = ethers.keccak256(ethers.toUtf8Bytes("settle-fail-001"));

      await expect(
        vault.connect(user).releasePayment(paymentId, merchant.address, amount)
      ).to.be.revertedWithCustomError(
        vault,
        "AccessControlUnauthorizedAccount"
      );
    });

    it("should revert if vault has insufficient liquidity", async function () {
      const excessiveAmount = ethers.parseUnits("10000", 6);
      const paymentId = ethers.keccak256(ethers.toUtf8Bytes("excess-001"));

      await expect(
        vault
          .connect(relayer)
          .releasePayment(paymentId, merchant.address, excessiveAmount)
      ).to.be.revertedWith("Insufficient vault liquidity");
    });
  });

  describe("rebalanceVault", function () {
    it("should allow treasury role to rebalance liquidity", async function () {
      await usdc.mint(await vault.getAddress(), ethers.parseUnits("200", 6));
      const amount = ethers.parseUnits("100", 6);

      await expect(vault.connect(admin).rebalanceVault(admin.address, amount))
        .to.emit(vault, "VaultRebalanced")
        .withArgs(admin.address, amount, admin.address);
    });
  });

  describe("refund after timeout", function () {
    const amount = ethers.parseUnits("40", 6);
    const paymentId = ethers.keccak256(ethers.toUtf8Bytes("refund-001"));
    let refundTimeout: number;

    beforeEach(async function () {
      refundTimeout = Number(await vault.REFUND_TIMEOUT());

      await usdc.connect(user).approve(await vault.getAddress(), amount);
      await vault
        .connect(user)
        .depositPayment(paymentId, amount, STELLAR_DOMAIN, MOCK_RECIPIENT_BYTES, "0x");
    });

    describe("acknowledgePayment", function () {
      it("should let the relayer acknowledge an initiated payment", async function () {
        await expect(vault.connect(relayer).acknowledgePayment(paymentId))
          .to.emit(vault, "PaymentAcknowledged")
          .withArgs(paymentId, relayer.address);

        const payment = await vault.payments(paymentId);
        expect(payment.status).to.equal(4); // ACKNOWLEDGED
      });

      it("should revert if called by non-relayer", async function () {
        await expect(
          vault.connect(user).acknowledgePayment(paymentId)
        ).to.be.revertedWithCustomError(vault, "AccessControlUnauthorizedAccount");
      });

      it("should revert for a payment that is not initiated", async function () {
        await vault.connect(relayer).acknowledgePayment(paymentId);

        await expect(
          vault.connect(relayer).acknowledgePayment(paymentId)
        ).to.be.revertedWith("Payment not acknowledgeable");

        const unknownId = ethers.keccak256(ethers.toUtf8Bytes("unknown"));
        await expect(
          vault.connect(relayer).acknowledgePayment(unknownId)
        ).to.be.revertedWith("Payment not acknowledgeable");
      });

      it("should let the relayer refund an acknowledged payment", async function () {
        await vault.connect(relayer).acknowledgePayment(paymentId);
        const balanceBefore = await usdc.balanceOf(user.address);

        await expect(vault.connect(relayer).refundPayment(paymentId))
          .to.emit(vault, "PaymentRefunded")
          .withArgs(paymentId, user.address, amount);

        expect((await usdc.balanceOf(user.address)) - balanceBefore).to.equal(amount);
      });
    });

    describe("claimRefund", function () {
      it("should let the payer refund after the timeout", async function () {
        await increaseTime(refundTimeout);
        const balanceBefore = await usdc.balanceOf(user.address);

        await expect(vault.connect(user).claimRefund(paymentId))
          .to.emit(vault, "PaymentRefunded")
          .withArgs(paymentId, user.address, amount);

        expect((await usdc.balanceOf(user.address)) - balanceBefore).to.equal(amount);
        const payment = await vault.payments(paymentId);
        expect(payment.status).to.equal(3); // REFUNDED
      });

      it("should revert before the timeout elapses", async function () {
        await increaseTime(refundTimeout - 60);

        await expect(vault.connect(user).claimRefund(paymentId)).to.be.revertedWith(
          "Refund timeout not elapsed"
        );
      });

      it("should revert when called by someone other than the payer", async function () {
        await increaseTime(refundTimeout);

        await expect(vault.connect(merchant).claimRefund(paymentId)).to.be.revertedWith(
          "Not the payer"
        );
      });

      it("should not refund a payment the relayer acknowledged", async function () {
        await vault.connect(relayer).acknowledgePayment(paymentId);
        await increaseTime(refundTimeout);

        await expect(vault.connect(user).claimRefund(paymentId)).to.be.revertedWith(
          "Payment not refundable"
        );
      });

      it("should not refund a released payment", async function () {
        const releaseId = ethers.keccak256(ethers.toUtf8Bytes("released-001"));
        await vault.connect(relayer).releasePayment(releaseId, merchant.address, amount);
        await increaseTime(refundTimeout);

        await expect(vault.connect(merchant).claimRefund(releaseId)).to.be.revertedWith(
          "Payment not refundable"
        );
      });

      it("should prevent a double refund", async function () {
        await increaseTime(refundTimeout);
        await vault.connect(user).claimRefund(paymentId);

        await expect(vault.connect(user).claimRefund(paymentId)).to.be.revertedWith(
          "Payment not refundable"
        );
      });

      it("should block reentrancy during the refund transfer", async function () {
        const TokenFactory = await ethers.getContractFactory("ReentrantRefundToken");
        const token = await TokenFactory.deploy();
        await token.waitForDeployment();

        const VaultFactory = await ethers.getContractFactory("ZIP0PaymentVault");
        const tokenVault = await VaultFactory.deploy(
          await token.getAddress(),
          admin.address,
          relayer.address
        );
        await tokenVault.waitForDeployment();

        const reentrantId = ethers.keccak256(ethers.toUtf8Bytes("reentrant-001"));
        await token.depositInto(await tokenVault.getAddress(), reentrantId, amount);
        await increaseTime(refundTimeout);

        await expect(token.claim()).to.be.revertedWithCustomError(
          tokenVault,
          "ReentrancyGuardReentrantCall"
        );
      });
    });
  });
});
