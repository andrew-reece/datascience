data2 <- read.csv('moviedb.csv')

View(data)
data3 <- data2[c(1:4,6:ncol(data2))]

View(data3)
library(psych)

corr.test(data3$avg_senti_score, data3$rating)

data4 <- data3[c(3,6,7,8)]

corr.test(data4[data4$post_length>200,])

View(data4)

data4$abs.z <- abs(scale(data4$avg_senti_score, center=T, scale=T))
data4$abs.z.rating <- abs(scale(data4$rating, center=T, scale=T))

corr.test(data4[data4$post_length>100,])