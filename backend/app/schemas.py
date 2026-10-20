from pydantic import BaseModel, Field

class AITestRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)

class AITestResponse(BaseModel):
    product: str
    model: str
    reply: str