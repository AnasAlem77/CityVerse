import { Controller, Get, Param, Query } from '@nestjs/common';
import { RecommendationQueryDto } from './dto/recommendation-query.dto';
import { RecommendationsService } from './recommendations.service';

@Controller('recommendations')
export class RecommendationsController {
  constructor(private readonly recommendations: RecommendationsService) {}
  @Get('cities/:cityId') city(@Param('cityId') cityId: string, @Query() query: RecommendationQueryDto) { return this.recommendations.recommend({ ...query, cityId, mode: 'city' }); }
  @Get('category') category(@Query() query: RecommendationQueryDto) { return this.recommendations.recommend({ ...query, mode: 'category' }); }
  @Get('nearby') nearby(@Query() query: RecommendationQueryDto) { return this.recommendations.recommend({ ...query, mode: 'nearby' }); }
  @Get('similar/:placeId') similar(@Param('placeId') placeId: string, @Query() query: RecommendationQueryDto) { return this.recommendations.recommend({ ...query, placeId, mode: 'similar' }); }
  @Get('personalized') personalized(@Query() query: RecommendationQueryDto) { return this.recommendations.recommend({ ...query, mode: 'personalized' }); }
}
