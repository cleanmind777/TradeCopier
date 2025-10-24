import databento as db
from app.core.config import settings

client = db.Historical(settings.DATABENTO_KEY)

async def convert_rawsymbol_intrument_id(symbols=list[str]):
    result = await client.symbology.resolve(
        dataset="GLBX.MDP3",
        symbols=symbols,
        stype_in="raw_symbol",
        stype_out="instrument_id",
        start_date="2025-10-01"
    )
    result_list = [{symbol: values[0]['s']} for symbol, values in result['result'].items()]
    return result_list


