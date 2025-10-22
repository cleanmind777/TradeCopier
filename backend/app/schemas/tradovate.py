from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional, Dict, Any
from datetime import datetime
from uuid import UUID
import json

class TradovateOrderListResponse(BaseModel):
    id: int
    accountId: int
    contractId: int
    timestamp: datetime
    action: str
    ordStatus: str
    executionProviderId: Optional[int] = None
    archived: bool
    external: bool
    admin: bool

class TradovateOrderForFrontend(TradovateOrderListResponse):
    symbol: str
    price: float
    accountNickname: str
    accountDisplayName: str

class TradeDate(BaseModel):
    year: int
    month: int
    day: int

class TradovatePositionListResponse(BaseModel):
    id: int
    accountId: int
    contractId: int
    timestamp: datetime
    tradeDate: TradeDate
    netPos: int
    netPrice: float
    bought: int
    boughtValue: float
    sold: int
    soldValue: float
    archived: bool
    prevPos: int

class TradovatePositionListForFrontend(BaseModel):
    id: int
    accountId: int
    contractId: int
    accountNickname: str
    accountDisplayName: str
    symbol: str
    netPos: int
    netPrice: float
    bought: int
    boughtValue: float
    sold: int
    soldValue: float


class TradovateProductItemResponse(BaseModel):
    id: int
    name: str
    currencyId: int
    productType: str
    description: str
    exchangeId: int
    exchangeChannelId: int
    contractGroupId: int
    riskDiscountContractGroupId: int
    status: str
    months: str
    valuePerPoint: float
    priceFormatType: str
    priceFormat: int
    tickSize: float
    allowProviderContractInfo: bool
    isMicro: bool
    marketDataSource: str
    lookupWeight: int
    hasReplay: bool
    settlementMethod: str

class TradovateContractMaturityItemResponse(BaseModel):
    id: int
    productId: int
    expirationMonth: int
    expirationDate: datetime
    archived: bool
    seqNo: int
    isFront: bool

class TradovateContractItemResponse(BaseModel):
    id: int
    name: str
    contractMaturityId: int
    status: str
    providerTickSize: float

class TradovateCashBalanceResponse(BaseModel):
    id: int
    accountId: int
    timestamp: datetime
    tradeDate: TradeDate
    currencyId: int
    amount: float
    realizedPnL: float
    weekRealizedPnL: float
    archived: bool
    amountSOD: float

class TradovateAccountsForFrontend(BaseModel):
    id: int
    accountId: int
    timestamp: datetime
    currencyId: int
    amount: float
    realizedPnL: float
    weekRealizedPnL: float
    archived: bool
    amountSOD: float
    accountNickname: str
    accountDisplayName: str

class TradovateMarketOrder(BaseModel):
    accountId: str
    accountSpec: str
    symbol: str
    orderQty: int
    orderType: str
    action: str
    isAutomated: bool

class TradovateLimitOrder(TradovateMarketOrder):
    price: float

class TradovateLimitBracket(BaseModel):
    action: str
    orderType: str
    price: float

class TradovateStopBracket(BaseModel):
    action: str
    orderType: str
    stopPrice: float

class TradovateLimitOrderWithSLTP(TradovateLimitOrder):
    bracket1: TradovateLimitBracket
    brakcet2: TradovateStopBracket