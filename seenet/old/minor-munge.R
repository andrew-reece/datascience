com.data <- read.csv("communication-tally-by-pair-full.csv",header=T)
View(com.data)
com.data <- com.data[,2:ncol(com.data)]
com.data <- com.data[,c(1:3,5:ncol(com.data),4)]
colSums(com.data)

write.csv(com.data,'com-pairs-time-series.csv',row.names=F)
