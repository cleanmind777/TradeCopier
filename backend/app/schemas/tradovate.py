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
    executionProviderId: int
    archived: bool
    external: bool
    admin: bool

class TradovateOrderForFrontend(TradovateOrderListResponse):
    symbol: str

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
    accountNickname: str
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